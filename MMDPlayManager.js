// ! 必须在MMDPlayManager类外正确传入 renderer camera scene
// TODO 添加所需依赖文件
// TODO Renderer开启shadowMap

let MMDPlayManager = class {

    maxPlayEnd = -1;
    minPlayEnd = -1;

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

    constructor(params = {}, ClassOfDurationData) {
        this.configuration = {
            loopPlay: params.loopPlay || false, //设置循环播放，默认为false
            playEnd: params.playEnd || "minPlayEnd", //设置所有文件播放时间其中的最大值或最小值作为播放结束的标志，默认为最小时间结束播放
            renderFPS: params.renderFPS || 60, //设置渲染帧率，默认为60HZ
            enableCCDIKHelper: params.enableCCDIKHelper || false,
            enablePhysicsHelper: params.enablePhysicsHelper || false,
            enablePhysicWhenMMDPause: params.enablePhysicWhenMMDPause || true, //播放暂停时仍开启物理效果，默认为true
            enablePauseWhenLeaveCurrentPage: params.enablePauseWhenLeaveCurrentPage || true, //当离开页面时启用暂停，减少算力消耗，默认为true
            mmdLoader: {},
            mmdAnimationHelper: {},
            mmdFilesPath: {
                modelFile: params.mmdFilesPath.modelFile || "",
                vmdFile: params.mmdFilesPath.vmdFile || "",
                cameraFile: params.mmdFilesPath.cameraFile || "",
                audioFile: params.mmdFilesPath.audioFile || ""
            },
            audioDelayTime: params.audioDelayTime || 0.0,
            enableStatsTool: params.enableStatsTool || true, //开启FPS显示工具
            enableControlTool: params.enableControlTool || true, //开启场景控制工具
        }
        if (ClassOfDurationData != undefined) {
            if (ClassOfDurationData.constructor.name == 'DurationData') {
                this.totalDuration = ClassOfDurationData.totalDuration;
                var { totalDuration } = this;
                for (const key in totalDuration) {
                    if (totalDuration[key] > 0) {
                        if (totalDuration[key] > this.maxPlayEnd)
                            this.maxPlayEnd = totalDuration[key]
                        if (totalDuration[key] < this.minPlayEnd || this.minPlayEnd < 0)
                            this.minPlayEnd = totalDuration[key]
                    }
                }
            } else throw new Error("MMDPlayManager: Unvaild instance. Use DurationData instance.");
        }
        this._createMMDPlayer();

        //*当离开页面时启用暂停，减少算力消耗
        _visibilityChangePlayPauseManager(this.configuration.enablePauseWhenLeaveCurrentPage);
    }

    _createMMDPlayer() {
        //创建MMD加载器和MMDAnimationHelper
        this.mmdLoader = new THREE.MMDLoader(this.configuration.mmdLoader);
        this.mmdAnimationHelper = new THREE.MMDAnimationHelper(this.configuration.MMDAnimationHelper);

        //创建音频
        this.audioListener = new THREE.AudioListener();
        camera.add(audioListener);
        this.audio = new THREE.Audio(audioListener);
        this.audioLoader = new THREE.AudioLoader();

        //开启FPS显示工具
        if (this.configuration.enableStatsTool) {
            this.statsContainer = document.createElement('div');
            document.body.appendChild(container);
            this.stats = new Stats();
            this.statsContainer.appendChild(this.stats.dom);
        }

        //创建时钟
        this.clock = new THREE.Clock();

        //创建OrbitControls工具
        if (this.configuration.enableControlTool) {
            this.controls = new THREE.OrbitControls(camera, renderer.domElement);

        }
    }

    _loadMMDPlayer() {
        var that = this; //引向当前类所属的this指针
        this.mmdLoader.loadWithAnimation(
            this.configuration.mmdFilesPath.modelFile,
            this.configuration.mmdFilesPath.vmdFile,
            function (modelAndAnimeInfo) {
                //模型开启投掷投影，接收投影
                modelAndAnimeInfo.mesh.castShadow = true;
                modelAndAnimeInfo.mesh.receiveShadow = true;

                //添加模型信息SkinnedMesh到helper
                that.mmdAnimationHelper.add(modelAndAnimeInfo.mesh, { animation: modelAndAnimeInfo.animation, physics: true });

                //添加到模型到场景
                scene.add(modelAndAnimeInfo.mesh);

                //加载音频文件
                that.audioLoader.load(
                    that.configuration.mmdFilesPath.audioFile,
                    function (audioBuffer) {
                        that.audio.setBuffer(audioBuffer);
                        that.mmdAnimationHelper.add(that.audio, { delayTime: this.configuration.audio });
                    },
                    that._onProgress, that._onError
                );

                //是否显示骨骼
                if (that.configuration.enableCCDIKHelper == true) {
                    that.ikSolver = new THREE.CCDIKSolver(modelAndAnimeInfo.mesh, modelAndAnimeInfo.mesh.geometry.iks);
                    that.ikHelper = that.ikSolver.createHelper();
                    that.ikHelper.visible = true;
                    scene.add(that.ikHelper);
                }

                //是否显示物理刚体
                if (that.configuration.enablePhysicsHelper == true) {
                    that.physicsSolver = that.mmdAnimationHelper.objects.get(modelAndAnimeInfo.mesh).physics;
                    that.physicsHelper = that.physicsSolver.createHelper();
                    that.physicsHelper.visible = true;
                    scene.add(that.physicsHelper);
                }

            }, this._onProgress, this._onError)
    }

    _onProgress(xhr) {
        console.log((xhr.loaded / xhr.total * 100) + '% loaded')
    }

    _onError(err) {
        throw new Error("MMDPlayManager: Error happened when loading player.\nError Info:", err);
    }

    _animationRender(RenderType) {
        if (RenderType == 'ControlRender') {
            //更新FPS工具
            this.stats.update();
            //是否启用暂停时包含物理动作帧
            if (this.configuration.enablePhysicWhenMMDPause == true) this.mmdAnimationHelper.update(0);
            //渲染
            renderer.render(scene, camera);
        } else if (RenderType == 'NotRender') {
            console.log("MMD渲染帧完全关闭");
        } else if (RenderType == undefined || RenderType == null) {
            this.totalTime += this.clock.getDelta();
            this.stats.update();
            this.mmdAnimationHelper.update(timeDelta);
            renderer.render(scene, camera);
        }
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
                if (beforeVisibilityChangePlayStatus.visible == 'play') this.playStatus = 'play'
                else return beforeVisibilityChangePlayStatus.visible
            } else if (args[0] == "pause" && args[1] == "v") this.playStatus = 'pause'
        }

        if (this.playStatus == "pause") {
            clearInterval(this.renderIntervalID);
            this.renderIntervalID = setInterval(() => { this._animationRender("ControlRender") }, 1000 / this.configuration.renderFPS);
            return this.playStatus;
        } else if (this.playStatus == "play") {
            clearInterval(this.renderIntervalID);
            clock = new THREE.Clock();
            this.renderIntervalID = setInterval(() => { this._animationRender() }, 1000 / this.configuration.renderFPS);
            return this.playStatus;
        }
    }

    //TODO：检查中断暂停的位置，之后再决定是否继续播放
    isEndPlay(duration) {
        if (this.configuration.playEnd == "minPlayEnd")
            return duration >= this.minPlayEnd;
        else
            return duration >= this.maxPlayEnd;
    }

    //*当离开页面时启用暂停，减少算力消耗
    beforeVisibilityChangePlayStatus = { visible: String, hidden: String };
    __visibilityChangeEventAdded = false;
    _visibilityChangePlayPauseManager(enable) {
        let visibilityChangePlayPause = function () {
            // console.log(document.webkitVisibilityState);
            if (document.webkitVisibilityState == "visible") {
                this.beforeVisibilityChangePlayStatus.hidden = playStatus;
                this.PlayPause("play", 'v');
            }
            else {
                this.beforeVisibilityChangePlayStatus.visible = playStatus;
                this.PlayPause("pause", 'v');
            }
        }

        if (this.__visibilityChangeEventAdded == false) {
            document.addEventListener('webkitvisibilitychange', visibilityChangePlayPause, true);
            this.__visibilityChangeEventAdded = true;
        }
    }

    _controlManager(enable) {
        this.controls.addEventListener('change', function () {
            if (this.playStatus != "pause") {
                clearInterval(this.renderIntervalID);
                this._animationRender();
                this.renderIntervalID = setInterval(() => { this._animationRender() }, 1000 / this.configuration.renderFPS);
                console.log("场景控制插入帧渲染", renderIntervalID);
            }
        });//监听鼠标、键盘事件
    }
}