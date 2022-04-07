// ! 必须在MMDPlayManager类外正确传入 renderer camera scene
// TODO 添加所需依赖文件
// TODO Renderer开启shadowMap

let MMDPlayManager = class {
    mmdLoader;
    mmdAnimationHelper;

    audioListener;
    audio;
    audioLoader;

    ikSolver;
    ikHelper;
    physicsSolver;
    physicsHelper;

    stats;

    statsContainer;

    clock;

    controls;

    playStatus = "play"; //播放状态
    totalTime = 0; //当前MMD总播放时间
    renderIntervalID; //渲染延时器ID

    durationRecorder; //类-文件时长记录器 记录每个文件的时间长度及所有文件中最大和最小时间长度

    onLoadParams = {
        needLoadFileNum: Number(),
        currentLoadFileNum: Number(),
        //*各MMD文件加载状态
        loadStatus: {
            modelFile: false,
            motionFile: false,
            cameraFile: false,
            audioFile: false
        },
        callbackFunc: Function(),
        // ?FuncArg: Array()
    };


    //********!正在测试的方法 无法确定对象是否可以进行浅拷贝
    // scene;
    // camera;
    // renderer;
    // document;
    //******** 

    constructor(params = {}) {
        this.configuration = {
            loopPlay: params.loopPlay || false, //设置循环播放，默认为false
            playEnd: params.playEnd || "minPlayEnd", //设置所有文件播放时间其中的最大值或最小值作为播放结束的标志，默认为最小时间结束播放
            renderFPS: params.renderFPS || 60, //设置渲染帧率，默认为60HZ
            enableCCDIKHelper: params.enableCCDIKHelper || false,
            enablePhysicsHelper: params.enablePhysicsHelper || false,
            //!播放暂停时仍开启物理效果，默认为false。注意：开启后，页面缩小或不显示时图像仍在渲染
            enablePhysicWhenMMDPause: params.enablePhysicWhenMMDPause || false,
            enablePauseWhenLeaveCurrentPage: params.enablePauseWhenLeaveCurrentPage || true, //当离开页面时启用暂停，减少算力消耗，默认为true
            mmdLoader: {},
            mmdAnimationHelper: {},
            mmdFilesPath: {
                modelFile: params.mmdFilesPath.modelFile || "",
                motionFile: params.mmdFilesPath.motionFile || "",
                cameraFile: params.mmdFilesPath.cameraFile || "",
                audioFile: params.mmdFilesPath.audioFile || ""
            },
            audioDelayTime: params.audioDelayTime || 0.0,
            enableStatsTool: params.enableStatsTool || true, //开启FPS显示工具
            enableControlTool: params.enableControlTool || true, //开启场景控制工具
            enableMustLoadModelFile: true, //! 选择开启必须加载模型文件
            enableLoadMMDWhenCreateManager: true, //* 选择在此类被创建(运行本构造函数)时就开始加载MMD

        }

        //* 检测是否在此类被创建(运行本构造函数)时就开始加载MMD
        if (this.configuration.enableLoadMMDWhenCreateManager)
            this.startLoadingMMD();
    }

    startLoadingMMD() {
        //* 检测是否已加载模型文件和动作文件
        if (this.configuration.enableMustLoadModelFile) {
            if (this.configuration.mmdFilesPath.modelFile == "") {
                throw new Error("\n\nMMDPlayManager: modelFile and motionFile not loaded.\nMust load modelFile and motionFile enabled.\n");
            }
        }

        //* 计算需加载文件数量
        let filePath = this.configuration.mmdFilesPath
        // let loadStatus = this.onLoadParams.loadStatus

        for (const fileKey in filePath) {
            if (filePath[fileKey] != "") {
                this.onLoadParams.needLoadFileNum++;
            }
        }

        this._createMMDPlayer();
        this._loadMMDPlayer();
        this.renderIntervalID = setInterval(() => { this._animationRender(); }, 1000 / this.configuration.renderFPS);
    }

    //*当MMD文件加载完成时调用此函数
    onLoad(callback) {
        //? onLoad(callback, ...args) {
        this.onLoadParams.callbackFunc = callback;
        //? this.onLoadParams.FuncArg = args;
    }

    __onLoadEventTriggered = false; //*加载事件只能触发一次 此方法检测加载事件是否被触发
    _onLoad(params = {}) {
        //传入所加载完成文件的参数
        let loadStatus = this.onLoadParams.loadStatus;
        for (const fileName in params) {

            this.onLoadParams.currentLoadFileNum++;
            for (const loadStatusName in loadStatus) {
                if (loadStatusName == fileName) {
                    loadStatus[loadStatusName] = params[fileName];
                    break;
                }
            }
        }

        //* 检测是否加载完成，仅在调用此函数时
        let isLoadFinish = this.onLoadParams.needLoadFileNum >= this.onLoadParams.currentLoadFileNum;

        if (isLoadFinish == true && this.__onLoadEventTriggered == false) {

            this.__onLoadEventTriggered = true

            //在文件加载完成后启用Stats FPS分析工具
            this._statsManager(this.configuration.enableStatsTool);

            //在文件加载完成后启用 当离开页面时启用暂停，减少算力消耗
            this._visibilityChangePlayPauseManager(this.configuration.enablePauseWhenLeaveCurrentPage);

            //创建OrbitControls工具
            if (this.configuration.enableControlTool) {
                this.controls = new THREE.OrbitControls(camera, renderer.domElement);
                //?在文件加载完成后启用控制
                // this._controlManager(this.configuration.enableControlTool);
            }

            //*调用onLoad的回调函数
            this.onLoadParams.callbackFunc();
        }
    }

    _createMMDPlayer() {
        //创建MMD加载器和MMDAnimationHelper
        this.mmdLoader = new THREE.MMDLoader(this.configuration.mmdLoader);
        this.mmdAnimationHelper = new THREE.MMDAnimationHelper(this.configuration.MMDAnimationHelper);

        //创建音频
        this.audioListener = new THREE.AudioListener();
        camera.add(this.audioListener);
        this.audio = new THREE.Audio(this.audioListener);
        this.audioLoader = new THREE.AudioLoader();

        //开启FPS显示工具
        if (this.configuration.enableStatsTool) {
            this.stats = new Stats();
        }

        //创建时钟
        this.clock = new THREE.Clock();

        //创建文件时长记录器
        this.durationRecorder = new DurationRecorder();
    }

    _loadMMDPlayer() {
        this.mmdLoader = new THREE.MMDLoader().loadWithAnimation(
            this.configuration.mmdFilesPath.modelFile,
            this.configuration.mmdFilesPath.motionFile,
            (modelAndAnimeInfo) => {
                //模型开启投掷投影，接收投影
                modelAndAnimeInfo.mesh.castShadow = true;
                modelAndAnimeInfo.mesh.receiveShadow = true;

                //添加模型信息SkinnedMesh到helper
                this.mmdAnimationHelper.add(modelAndAnimeInfo.mesh, { animation: modelAndAnimeInfo.animation, physics: true });

                //添加到模型到场景
                scene.add(modelAndAnimeInfo.mesh);

                //加载音频文件
                this.audioLoader.load(
                    this.configuration.mmdFilesPath.audioFile,
                    (audioBuffer) => {
                        this.audio.setBuffer(audioBuffer);
                        this.mmdAnimationHelper.add(this.audio, { delayTime: this.configuration.audioDelayTime });

                        //更新时间记录器数据-音频
                        this.durationRecorder.update({ audioDuration: audioBuffer.duration });
                        //更新音频文件已加载完成
                        this._onLoad({ audioFile: true })
                    },
                    this._onProgress, this._onError
                );

                //更新动作文件时间记录器数据
                this.durationRecorder.update({ motionDuration: modelAndAnimeInfo.animation.duration });
                //更新动作与模型文件已加载完成
                this._onLoad({ motionFile: true, modelFile: true })

                //是否显示骨骼
                if (this.configuration.enableCCDIKHelper == true) {
                    this.ikSolver = new THREE.CCDIKSolver(modelAndAnimeInfo.mesh, modelAndAnimeInfo.mesh.geometry.iks);
                    this.ikHelper = this.ikSolver.createHelper();
                    this.ikHelper.visible = true;
                    scene.add(this.ikHelper);
                }

                //是否显示物理刚体
                if (this.configuration.enablePhysicsHelper == true) {
                    this.physicsSolver = this.mmdAnimationHelper.objects.get(modelAndAnimeInfo.mesh).physics;
                    this.physicsHelper = this.physicsSolver.createHelper();
                    this.physicsHelper.visible = true;
                    scene.add(this.physicsHelper);
                }
            },
            this._onProgress,
            this._onError
        )
    }

    _onProgress(xhr) {
        // console.log((xhr.loaded / xhr.total * 100) + '% loaded')

        if (xhr.loaded / xhr.total == 1) {
            console.log("Loaded.");
        }
    }

    _onError(err) {
        throw new Error("MMDPlayManager: Error happened when loading player.\nError Info:", err);
    }

    // _animationRender_loadEventHolder
    _animationRender(RenderType) {

        //!callback
        renderer.setSize(window.innerWidth, window.innerHeight);
        fixCameraRatio();

        //????
        // loadEventHolder = new LoadEventHolder();
        // onLoad(callback) = loadEventHolder.event(callback);

        if (RenderType == 'ControlRender') {
            //更新FPS工具
            this.stats.update();
            //是否启用暂停时包含物理动作帧
            if (this.configuration.enablePhysicWhenMMDPause == true)
                this.mmdAnimationHelper.update(0);
            //渲染
            renderer.render(scene, camera);
        } else if (RenderType == undefined || RenderType == null) {
            let timeDelta = this.clock.getDelta();

            this.totalTime += timeDelta;
            this.stats.update();
            this.mmdAnimationHelper.update(timeDelta);
            renderer.render(scene, camera);
        } else if (RenderType == 'NotRender') {
            console.log("MMD渲染帧完全关闭");
        }
    }

    removeAll() {

    }

    rePlay() {

    }

    //*播放与暂停事件
    PlayPause(...args) {
        if (args.length == 0) {
            this.playStatus = this.playStatus == "play" ? "pause" : "play"
        } else if (args.length == 1) {
            if (this.playStatus == args[0]) return this.playStatus;
            else this.playStatus = args[0] == "play" ? "play" : "pause"
        } else {
            if (args[0] == "play" && args[1] == "v") {
                if (this.beforeVisibilityChangePlayStatus.visible == 'play') this.playStatus = 'play'
                else return this.beforeVisibilityChangePlayStatus.visible
            } else if (args[0] == "pause" && args[1] == "v") this.playStatus = 'pause'
        }

        if (this.playStatus == "pause") {
            clearInterval(this.renderIntervalID);
            this.renderIntervalID = setInterval(() => { this._animationRender("ControlRender") }, 1000 / this.configuration.renderFPS);
            return this.playStatus;
        } else if (this.playStatus == "play") {
            clearInterval(this.renderIntervalID);
            this.clock = new THREE.Clock();
            this.renderIntervalID = setInterval(() => { this._animationRender() }, 1000 / this.configuration.renderFPS);
            return this.playStatus;
        }
    }

    //*当离开页面时启用暂停，减少算力消耗
    beforeVisibilityChangePlayStatus = { visible: String(), hidden: String() };
    __visibilityChangeEventAdded = false;
    //*该监听器事件暂时只支持开启，且开启后不能被关闭
    _visibilityChangePlayPauseManager(enable) {
        if (enable) {
            let visibilityChangePlayPause = () => {
                // console.log(document.webkitVisibilityState);
                if (document.webkitVisibilityState == "visible") {
                    this.beforeVisibilityChangePlayStatus.hidden = this.playStatus;
                    this.PlayPause("play", 'v');
                } else {
                    this.beforeVisibilityChangePlayStatus.visible = this.playStatus;
                    this.PlayPause("pause", 'v');
                }
            }

            if (!this.__visibilityChangeEventAdded) {
                document.addEventListener('webkitvisibilitychange', visibilityChangePlayPause, true);
                this.__visibilityChangeEventAdded = true;
            }
        }
    }

    //!待废除
    //*该监听器事件暂时只支持开启，且开启后不能被关闭
    _controlManager(enable) {
        if (enable) {
            this.controls.addEventListener('change', () => {
                clearInterval(this.renderIntervalID);
                this._animationRender();
                this.renderIntervalID = setInterval(() => { this._animationRender() }, 1000 / this.configuration.renderFPS);
                console.log("场景控制插入帧渲染", this.renderIntervalID);
            });
        }
    }

    //*该事件暂时只支持开启，且开启后不能被关闭
    _statsManager(enable) {
        if (enable) {
            this.statsContainer = document.createElement('div');
            document.body.appendChild(this.statsContainer);
            this.statsContainer.appendChild(this.stats.dom);
        }
    }


    //TODO：检查中断暂停的位置，之后决定是否继续播放
    isEndPlay(playDuration) {
        let durationRecorder = this.durationRecorder.getMaxMinDuration();
        if (this.configuration.playEnd == "minPlayEnd")
            return playDuration >= durationRecorder.minDuration;
        else
            return playDuration >= durationRecorder.maxDuration;
    }
}

//*每个文件的时间长度
let DurationRecorder = class {
    totalDuration = {
        motionDuration: Number(),
        cameraDuration: Number(),
        audioDuration: Number()
    }
    minDuration = Number();
    maxDuration = Number();

    constructor() { }
    update(params = {}) {
        for (const key in params) {
            for (const totalDurationName in this.totalDuration) {
                if (key == totalDurationName) {
                    this.totalDuration[totalDurationName] = params[key];
                    break;
                }
            }
        }

        for (const key in this.totalDuration) {
            if (this.totalDuration[key] > 0) {
                if (this.totalDuration[key] > this.maxDuration) {
                    this.maxDuration = this.totalDuration[key];
                }
                if (this.totalDuration[key] < this.minDuration || this.minDuration == 0) {
                    this.minDuration = this.totalDuration[key];
                }
            }
        }

        return this;
    }

    getMaxMinDuration() {
        return { minDuration, maxDuration };
    }
}

//????????
let LoadEventHolder = class {
    callbackFunc = Function();
    returnCallbackArgs = Array();
    __onLoadEventTriggered = Boolean();
    __allowMultiTrigger = Boolean();

    constructor() { }

    event(callback) {
        this.callbackFunc = callback
    }
}