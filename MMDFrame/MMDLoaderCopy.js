function addBoxGeometry(x, y, z, color) {
    var boxGeometry = new THREE.BoxGeometry(1, 1, 1);
    var material = new THREE.MeshLambertMaterial({ color });
    var mesh = new THREE.Mesh(boxGeometry, material);
    mesh.position.set(x, y, z);
    return mesh;
}

var scene = new THREE.Scene();

var ambient = new THREE.AmbientLight(0xffffff, 0.8); //环境光
scene.add(ambient);


const __planeGeometry = new THREE.PlaneGeometry(100, 100);
const planeMaterial = new THREE.MeshPhongMaterial({
    color: 0xb1ccd6,
    shininess: 10,
    specular: 0xffffff,
    side: THREE.DoubleSide
});

const plane = new THREE.Mesh(__planeGeometry, planeMaterial);
plane.rotateX(Math.PI / 2);
scene.add(plane);





var PointLight = new THREE.PointLight(0xffffff, 0.1); //点光源
PointLight.position.set(20, 20, 20);
PointLight.castShadow = true;
PointLight.shadow.bias = -0.0015;
PointLight.shadow.mapSize.width = 2048;
PointLight.shadow.mapSize.height = 2048;
scene.add(PointLight, addBoxGeometry(20, 20, 20, 0xffffff));





//坐标辅助系统
var axes = new THREE.AxisHelper(5000);
scene.add(axes);

var width = window.innerWidth;
var height = window.innerHeight;

var ratioWH = width / height; //窗口宽高比
var displayRange = 50; //三维场景显示范围控制系数，系数越大，显示的范围越大

var camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 1, 10000);

camera.position.set(20, 20, 20); //设置相机位置
camera.lookAt(scene.position); //设置相机方向(指向的场景对象)

var modelFile = "./models/LuoTianyi/luotianyi_v4_ver2.0.pmx";
var vmdFiles = "./models/201904202121169044.vmd";
var cameraFiles = "Camera.vmd";
var audioFiles = "./models/CUT.mp3";

var onProgress = function(xhr) { console.log((xhr.loaded / xhr.total * 100) + '% loaded') };
var onError = function(err) { console.log("Error Happened.", err) }

var enableCCDIKHelper = false; //配置-debug-显示骨骼
var enablePhysicsHelper = false; //配置-debug-显示物理刚体

var loader = new THREE.MMDLoader();
var helper = new THREE.MMDAnimationHelper({
    // configuration: {
    pmxAnimation: true,
    afterglow: 100.0,
    sync: true
        // }
});
var audioListene, sound, raudioLoader;


var test;
//加载模型文件和动作文件
loader.loadWithAnimation(modelFile, vmdFiles, function(object) {
    console.log("==>Mesh: ", object)

    test = object;

    //模型开启投掷投影，接收投影
    object.mesh.castShadow = true;
    object.mesh.receiveShadow = true;

    //添加SkinnedMesh到helper
    helper.add(object.mesh, {
        animation: object.animation,
        physics: true
    });
    scene.add(object.mesh);

    //加载音频文件
    audioListener = new THREE.AudioListener();
    camera.add(audioListener);
    sound = new THREE.Audio(audioListener);

    const audioLoader = new THREE.AudioLoader();
    audioLoader.load(audioFiles, function(audioBuffer) {
        sound.setBuffer(audioBuffer);
        //添加音频到helper
        var audioParams = {
            delayTime: 0.0
        }
        helper.add(sound, audioParams);
    }, onProgress, onError);

    if (enableCCDIKHelper == true) {
        //显示骨骼
        var ikSolver = new THREE.CCDIKSolver(object.mesh, object.mesh.geometry.iks);
        ikHelper = ikSolver.createHelper();
        ikHelper.visible = true;
        scene.add(ikHelper);
        console.log(ikHelper);

    }

    if (enablePhysicsHelper == true) {
        //显示物理刚体
        var physics = helper.objects.get(object.mesh).physics;
        var physicsHelper = physics.createHelper();
        physicsHelper.visible = true;
        scene.add(physicsHelper);
        console.log(physicsHelper);

    }

}, onProgress, onError);







var renderer = new THREE.WebGL1Renderer({
    antialias: true,
    alpha: true,
});

renderer.setPixelRatio(window.devicePixelRatio);
renderer.setSize(width, height);
renderer.setClearColor(0xffffff, 0.1);

renderer.shadowMap.enabled = true; //开启阴影设置
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

// scene.background = new THREE.Color(0xffffff);

document.body.appendChild(renderer.domElement);

const container = document.createElement('div');
document.body.appendChild(container);
stats = new Stats();
container.appendChild(stats.dom);

renderer.render(scene, camera);

var clock = new THREE.Clock();

let playStatus = "play"; //播放状态
let totalTime = 0; //当前mmd播放时间

var enablePhysicWhenMMDPause = true; //配置-暂停时包含物理动作帧

function animation(RenderType) {
    let timeDelta = clock.getDelta();
    totalTime += timeDelta;
    renderer.setSize(window.innerWidth, window.innerHeight);

    fixCameraRatio();

    if (RenderType == 'ControlRender') {
        stats.update();
        renderer.render(scene, camera);
        if (enablePhysicWhenMMDPause == true) {
            helper.update(0); //暂停时包含物理动作帧
        }
    } else if (RenderType == 'NotRender') {
        console.log("MMD渲染帧完全关闭");
    } else if (RenderType == undefined || RenderType == null) {
        stats.update();
        helper.update(timeDelta);
        renderer.render(scene, camera);
    }
}

var renderFPS = 50; //配置-设置渲染帧率
var renderIntervalID = setInterval(() => { animation(); }, 1000 / renderFPS);

var controls = new THREE.OrbitControls(camera, renderer.domElement); //创建控件对象
controls.addEventListener('change', function() {
    if (playStatus != "pause") {
        clearInterval(renderIntervalID);
        animation();
        renderIntervalID = setInterval(() => { animation() }, 1000 / renderFPS);
        // console.log("场景控制插入帧渲染", renderIntervalID);
    }
}); //监听鼠标、键盘事件

//不在此页面时暂停，减少算力资源消耗
var enablePauseWhenLeaveCurrentPage = true; //配置-启用离开页面暂停
var beforeVisibilityChangePlayStatus = { visible: String, hidden: String }; //在有页面隐藏和显示前的播放状态
function visibilityChangePlayPauseManager(status) {
    //不在此页面时暂停，减少算力资源消耗
    var visibilityChangePlayPause = function() {
        console.log(document.webkitVisibilityState);
        if (document.webkitVisibilityState == "visible") {
            beforeVisibilityChangePlayStatus.hidden = playStatus;
            PlayPause("play", 'v');
        } else {
            beforeVisibilityChangePlayStatus.visible = playStatus;
            PlayPause("pause", 'v');
        }
    }

    if (status == true) {
        document.addEventListener('webkitvisibilitychange', visibilityChangePlayPause, true)
    }
}
visibilityChangePlayPauseManager(enablePauseWhenLeaveCurrentPage);

function PlayPause(...args) {
    if (args.length == 0) {
        playStatus = playStatus == "play" ? "pause" : "play"
    } else if (args.length == 1) {
        if (playStatus == args[0]) {
            return playStatus;
        } else {
            playStatus = args[0] == "play" ? "play" : "pause"
        }
    } else {
        // console.log("ok")
        if (args[0] == "play" && args[1] == "v") {
            if (beforeVisibilityChangePlayStatus.visible == 'play')
                playStatus = 'play'
            else return beforeVisibilityChangePlayStatus.visible
        } else if (args[0] == "pause" && args[1] == "v") {
            playStatus = 'pause'
        }
    }

    if (playStatus == "pause") {
        // console.log("触发暂停");
        clearInterval(renderIntervalID);
        renderIntervalID = setInterval(() => { animation("ControlRender") }, 1000 / renderFPS);
        return playStatus;
    } else if (playStatus == "play") {
        clearInterval(renderIntervalID);
        clock = new THREE.Clock();
        renderIntervalID = setInterval(() => { animation() }, 1000 / renderFPS);
        return playStatus;
    }
}

var lastHeight = Number;
var lastWidth = Number;

function fixCameraRatio() {
    if (window.innerHeight != lastHeight || window.innerWidth != lastWidth) {
        lastHeight = window.innerHeight;
        lastWidth = window.innerWidth;
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix(); //重新计算投影矩阵
        console.log("重新计算投影矩阵");
    }
}