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

    loadEventHolder; //事件回调函数控制器

    modelSkinnedMesh

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
            loopPlay: params.loopPlay !== undefined ?
                params.loopPlay : false, //设置循环播放，默认为false

            playEnd: params.playEnd || "minPlayEnd", //设置所有文件播放时间其中的最大值或最小值作为播放结束的标志，默认为最小时间结束播放
            renderFPS: params.renderFPS || 60, //设置渲染帧率，默认为60HZ

            enableCCDIKHelper: params.enableCCDIKHelper !== undefined ?
                params.enableCCDIKHelper : false,

            enablePhysicsHelper: params.enablePhysicsHelper !== undefined ?
                params.enablePhysicsHelper : false,

            //!播放暂停时仍开启物理效果，默认为false。注意：开启后，页面缩小或不显示时图像仍在渲染
            enablePhysicWhenMMDPause: params.enablePhysicWhenMMDPause !== undefined ?
                params.enablePhysicWhenMMDPause : false,

            enablePauseWhenLeaveCurrentPage: params.enablePauseWhenLeaveCurrentPage !== undefined ?
                params.enablePauseWhenLeaveCurrentPage : true, //当离开页面时启用暂停，减少算力消耗，默认为true

            mmdLoader: params.mmdLoader,
            mmdAnimationHelper: params.mmdAnimationHelper,
            mmdFilesPath: {
                modelFile: params.mmdFilesPath.modelFile || "",
                motionFile: params.mmdFilesPath.motionFile || "./mmdFiles/default.vmd",
                cameraFile: params.mmdFilesPath.cameraFile || "",
                audioFile: params.mmdFilesPath.audioFile || ""
            },
            audioDelayTime: params.audioDelayTime || 0.0,

            enableStatsTool: params.enableStatsTool !== undefined ?
                params.enableStatsTool : true, //开启FPS显示工具

            enableControlTool: params.enableControlTool !== undefined
                ? params.enableControlTool : true, //开启场景控制工具

            enableMustLoadModelFile: params.enableMustLoadModelFile !== undefined
                ? params.enableMustLoadModelFile : true, //! 选择开启必须加载模型文件

            enableLoadMMDWhenCreateManager: params.enableLoadMMDWhenCreateManager !== undefined
                ? params.enableLoadMMDWhenCreateManager : true, //* 选择在此类被创建(运行本构造函数)时就开始加载MMD

            enableCameraMotion: params.enableCameraMotion !== undefined
                ? params.enableCameraMotion : true, //* 开启镜头动作(默认开启)
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

        //创建加载事件回调函数管理器
        this.loadEventHolder = new LoadEventHolder();

        //!!!!!!添加回调事件事件功能
        //!!!!!!添加对应方法的回调函数
        this.loadEventHolder.addFeedback({
            fileOnLoad: {},
            mmdPlayerLoaded: {},
            whenAnimationRender: {
                allowMultiTrigger: true,
                funcFeedback: () => {

                    // //设置循环播放检测
                    // this._autoReplayManager(this.configuration.loopPlay);
                }
            }
        });
    }

    //*当MMD文件加载完成时调用此函数
    onLoad(callback) {
        //TODO 已废除 this.onLoadParams.callbackFunc = callback;
        //* 添加回调函数
        this.loadEventHolder.addFeedback({ fileOnLoad: { userFeedback: callback } });
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
        let isLoadFinish = this.onLoadParams.currentLoadFileNum >= this.onLoadParams.needLoadFileNum;

        if (isLoadFinish == true && this.__onLoadEventTriggered == false) {

            this.__onLoadEventTriggered = true

            //在文件加载完成后启用Stats FPS分析工具
            this._statsManager(this.configuration.enableStatsTool);

            //在文件加载完成后启用 当离开页面时启用暂停，减少算力消耗
            console.log("===>", this.configuration.enablePauseWhenLeaveCurrentPage);
            this._visibilityChangePlayPauseManager(this.configuration.enablePauseWhenLeaveCurrentPage);

            //创建OrbitControls工具
            if (this.configuration.enableControlTool) {
                this.controls = new THREE.OrbitControls(camera, renderer.domElement);
                //?在文件加载完成后启用控制
                // this._controlManager(this.configuration.enableControlTool);
            }

            //* 执行onLoad的回调函数
            this.loadEventHolder.call({ fileOnLoad: {} });

            //* 开始渲染并播放

            //* 创建时钟
            this.clock = new THREE.Clock();
            this.renderIntervalID = setInterval(() => { this._animationRender(); }, 1000 / this.configuration.renderFPS);
            this.audio.play();
        }
    }

    _createMMDPlayer() {
        //创建MMD加载器
        this.mmdLoader = new THREE.MMDLoader(this.configuration.mmdLoader);

        //创建MMDAnimationHelper
        this.configuration.mmdAnimationHelper["pmxAnimation"] = true;
        this.mmdAnimationHelper = new THREE.MMDAnimationHelper(this.configuration.mmdAnimationHelper);

        //创建音频
        this.audioListener = new THREE.AudioListener();
        // camera.add(this.audioListener);
        this.audio = new THREE.Audio(this.audioListener);
        this.audioLoader = new THREE.AudioLoader();

        //开启FPS显示工具
        if (this.configuration.enableStatsTool) {
            this.stats = new Stats();
        }

        //创建文件时长记录器
        this.durationRecorder = new DurationRecorder();
    }

    _loadMMDPlayer() {
        //* 加载模型文件
        this.mmdLoader.load(
            this.configuration.mmdFilesPath.modelFile,
            // this.configuration.mmdFilesPath.motionFile,
            (modelInfo) => {
                console.log("Model:", modelInfo);

                //模型开启投掷投影，接收投影
                modelInfo.castShadow = true;
                modelInfo.receiveShadow = true;
                //添加到模型到场景
                scene.add(modelInfo);
                //更新模型文件已加载完成
                this._onFinish("模型");
                this._onLoad({ modelFile: true });

                //*加载动作文件
                let motionPath = this.configuration.mmdFilesPath.motionFile;
                if (motionPath != "") {
                    this.mmdLoader.loadAnimation(
                        motionPath,
                        modelInfo,
                        (motionInfo) => {
                            console.log("Motion:", motionInfo);
                            this.mmdAnimationHelper.add(modelInfo, {
                                animation: motionInfo, physics: true
                            });

                            //更新动作文件时间记录器数据
                            this.durationRecorder.update({ motionDuration: motionInfo.duration });

                            //更新动作文件已加载完成
                            this._onFinish("动作");
                            this._onLoad({ motionFile: true });
                        }, this._onProgress, this._onError)
                }

                //* 加载镜头文件
                let cameraPath = this.configuration.mmdFilesPath.cameraFile;
                if (cameraPath != "") {
                    this.mmdLoader.loadAnimation(
                        cameraPath,
                        camera,
                        (cameraInfo) => {
                            console.log("Camera:", cameraInfo);
                            this.mmdAnimationHelper.add(camera, { animation: cameraInfo });

                            //更新镜头文件时间记录器数据
                            this.durationRecorder.update({ cameraDuration: cameraInfo.duration });

                            //更新镜头文件已加载完成
                            this._onFinish("镜头");
                            this._onLoad({ cameraFile: true });
                        }, this._onProgress, this._onError)
                }

                //* 加载音频文件
                let audioPath = this.configuration.mmdFilesPath.audioFile;
                if (audioPath != "") {
                    this.audioLoader.load(
                        audioPath,
                        (audioBuffer) => {
                            this.audio.setBuffer(audioBuffer);
                            // this.mmdAnimationHelper.add(this.audio, { delayTime: this.configuration.audioDelayTime });

                            //更新时间记录器数据-音频
                            this.durationRecorder.update({ audioDuration: audioBuffer.duration });

                            //更新音频文件已加载完成
                            this._onFinish("音频");
                            this._onLoad({ audioFile: true });
                        },
                        this._onProgress, this._onError
                    );
                }

                //* 是否显示骨骼
                if (this.configuration.enableCCDIKHelper == true) {
                    this.ikSolver = new THREE.CCDIKSolver(modelAndAnimeInfo.mesh, modelAndAnimeInfo.mesh.geometry.iks);
                    this.ikHelper = this.ikSolver.createHelper();
                    this.ikHelper.visible = true;
                    scene.add(this.ikHelper);
                }

                //* 是否显示物理刚体
                if (this.configuration.enablePhysicsHelper == true) {
                    this.physicsSolver = this.mmdAnimationHelper.objects.get(modelAndAnimeInfo.mesh).physics;
                    this.physicsHelper = this.physicsSolver.createHelper();
                    this.physicsHelper.visible = true;
                    scene.add(this.physicsHelper);
                }

                //* 执行mmdPlayerLoaded的回调函数
                this.loadEventHolder.call({ whenAnimationRender: {} });
            },
            this._onProgress,
            this._onError
        )
    }

    _onFinish(tag) {
        console.log(tag, "文件加载完成");
    }

    _onProgress(xhr) {
        if (xhr.loaded / xhr.total == 1) {
            // console.log("文件载入完成", xhr);
        }
    }

    _onError(err) {
        throw new Error("MMDPlayManager: Error happened when loading player.\nError Info:", err);
    }


    _animationRender(RenderType) {

        let timeDelta = this.clock.getDelta();
        this.totalTime += timeDelta;

        if (RenderType == 'NoMotionRender') {
            // console.log("无动画渲染");
            //更新FPS工具
            this.stats.update();
            //是否启用暂停时包含物理动作帧
            if (this.configuration.enablePhysicWhenMMDPause == true)
                this.mmdAnimationHelper.update(0);
            renderer.render(scene, camera);
        } else if (RenderType == undefined || RenderType == null) {
            this.stats.update();
            this.mmdAnimationHelper.update(timeDelta);
            renderer.render(scene, camera);
        }

        //* 执行whenAnimationRender的回调函数
        this.loadEventHolder.call({ whenAnimationRender: {} });
    }

    replay() {
        //* 渲染器重置
        clearInterval(this.renderIntervalID);

        //* 播放时间重置
        this.totalTime = 0;

        let helperObject = this.mmdAnimationHelper.objects;

        //* 镜头重置
        helperObject.get(camera).mixer.time = 0;
        helperObject.get(camera).mixer._actions[0].time = 0;

        let modelMeshes = playManager.mmdAnimationHelper.meshes;
        for (let i = 0; i < modelMeshes.length; i++) {
            //* 模型动作重置
            helperObject.get(modelMeshes[i]).mixer.time = 0;
            helperObject.get(modelMeshes[i]).mixer._actions[0].time = 0;
            //* 模型物理重置
            helperObject.get(modelMeshes[i]).physics.reset();
        }

        //*时钟重置
        this.clock = new THREE.Clock();

        //*音频重置
        this.audio.stop();

        //*启动渲染
        this.renderIntervalID = setInterval(() => { this._animationRender(); }, 1000 / this.configuration.renderFPS);
        this.audio.play();
    }

    changeCamera(type) {
        if ((type == "control" || type == "remove") && this.mmdAnimationHelper.objects.get(camera)) {
            this.mmdAnimationHelper._clearCamera(camera);
            camera.up.set(0, 1, 0);

            //!!!待加入回调函数
            camera.position.set(0, 0, 50);
            camera.lookAt(0, 0, 50);

        } else if (type == "anime" && !this.mmdAnimationHelper.objects.get(camera)) {
            loadCameraAnimation();
        }
    }

    loadCameraAnimation() {
        let cameraDuration;

        //* 加载镜头文件
        let cameraPath = this.configuration.mmdFilesPath.cameraFile;
        if (cameraPath != "" && !this.mmdAnimationHelper.objects.get(camera)) {
            this.mmdLoader.loadAnimation(
                cameraPath,
                camera,
                (cameraInfo) => {
                    console.log("Camera:", cameraInfo);
                    cameraDuration = cameraInfo.duration;

                    if (cameraDuration >= this.totalTime) {
                        this.mmdAnimationHelper.add(camera, { animation: cameraInfo });
                        //* 相机动画匹配当前时间
                        this._onLoad({ cameraFile: true });
                    }
                }, this._onProgress, this._onError)
        }
        //* 匹配当前时间
    }

    _autoReplayManager(enable) {
        //判断结束播放，重新开始播放
        let minDuration = this.durationRecorder.minDuration;
        let maxDuration = this.durationRecorder.maxDuration;
        let currentTime = this.totalTime;

        if (currentTime != 0 && maxDuration != 0 && minDuration != 0) {
            if (enable && currentTime >= minDuration) {
                if (this.configuration.playEnd == "minPlayEnd") {

                    //* 到达最小播放时间时重放
                    clearInterval(this.renderIntervalID);
                    this.replay();
                } else {

                    //* 到达最大播放时间时重放
                    if (currentTime >= maxDuration) {
                        clearInterval(this.renderIntervalID);
                        this.replay();
                    }

                    //* 判断和设置动画无动作渲染
                    let motionDuration = this.durationRecorder.totalDuration.motionDuration;
                    if (motionDuration <= minDuration || motionDuration <= currentTime) {
                        console.log("设置静态");
                        clearInterval(this.renderIntervalID);
                        this.renderIntervalID = setInterval(() => { this._animationRender("NoMotionRender") }, 1000 / this.configuration.renderFPS);
                    }
                }
            }
        }
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
            //暂停音频
            this.audio.pause();

            clearInterval(this.renderIntervalID);
            this.renderIntervalID = setInterval(() => { this._animationRender("NoMotionRender") }, 1000 / this.configuration.renderFPS);
            return this.playStatus;
        } else if (this.playStatus == "play") {
            //播放音频
            this.audio.play();

            clearInterval(this.renderIntervalID);
            this.renderIntervalID = setInterval(() => { this._animationRender() }, 1000 / this.configuration.renderFPS);
            this.clock = new THREE.Clock();
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

    //!即将废除的管理器，不建议使用
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

    //!已废除
    //????? 没啥用 事件回调函数添加器
    // _loadEventHolder(addFeedback = []) {
    //     let params = {};
    //     for (let i = 0; i < addFeedback.length; i++) {
    //         params[addFeedback[i]] = {};

    //     }
    //     loadEventHolder.addFeedback({ fileOnLoad: {}, whenAnimationRender: {}, mmdPlayerLoaded: {} });
    // }
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

//* 事件回调函数控制器
let LoadEventHolder = class {

    configuration = {}

    keyDict = [
        { key: "userFeedback", default: Function() }, //* 用户回调函数
        { key: "userReturnArgs", default: Array() }, //* 用户回调函数回调形参数
        { key: "funcFeedback", default: Function() }, //* 第二个(可用于其他类)回调函数
        { key: "funcReturnArgs", default: Array() }, //* 第二个(可用于其他类)回调函数回调形参数
        { key: "allowMultiTrigger", default: false }, //* 允许多次触发
        { key: "__eventTriggered", default: false } // TODO 不可修改，用于判断回调函数是否被触发
    ];

    constructor(params = {}) {
        for (const paramsKey in params) {
            this.configuration[paramsKey] = {};
            for (let i = 0; i < this.keyDict.length; i++) {
                this.configuration[paramsKey][this.keyDict[i]["key"]] = params[paramsKey][this.keyDict[i]["key"]] || this.keyDict[i]["default"];
            }
        }
    }

    //* 添加回调函数到配置
    addFeedback(params = {}) {
        for (const paramsKey in params) {
            //* 一些判断配置是否为新添加，是则按照构造器定义，否则不添加keyDict中的默认参数
            let isNewlyAdd = false;
            if (!this.configuration[paramsKey]) {
                this.configuration[paramsKey] = {};
                isNewlyAdd = true;
            }
            for (let i = 0; i < this.keyDict.length; i++) {
                if (isNewlyAdd)
                    this.configuration[paramsKey][this.keyDict[i]["key"]] = params[paramsKey][this.keyDict[i]["key"]] || this.keyDict[i]["default"];
                else {
                    if (params[paramsKey][this.keyDict[i]["key"]]) {
                        this.configuration[paramsKey][this.keyDict[i]["key"]] = params[paramsKey][this.keyDict[i]["key"]];
                    }
                }
            }
        }
        return this;
    }

    //* 调用回调函数
    call(params = {}) {
        this.addFeedback(params);

        //* 回调函数
        for (const key in this.configuration) {
            for (const paramsKey in params) {
                let config = this.configuration[key];
                if (key == paramsKey) {
                    if (config.allowMultiTrigger == true || config.__eventTriggered == false) {
                        this.configuration[key].__eventTriggered = true;

                        //!如果参数只有一个，返回一个参数，否则，返回给回调函数整个数组作为参数
                        if (config.userReturnArgs.length == 0) {
                            config.userFeedback();
                            config.funcFeedback();
                        } else if (config.userReturnArgs.length == 1) {
                            config.userFeedback(config.userReturnArgs[0]);
                            config.funcFeedback(config.userReturnArgs[0]);
                        } else {
                            config.userFeedback(config.userReturnArgs);
                            config.funcFeedback(config.funcReturnArgs);
                        }
                    }
                }
            }
        }
        return this;
    }
}