



// let AuxLightObjects =
// {
//     AmbientLight: [
//         {
//             color: undefined,
//             intensity: undefined
//         }],
//     PointLight: [{}, {}],
//     DirectionalLight: [{}, {}],
//     SpotLight: [{}, {}]
// }




// import * as THREE from "../node_modules/three/build/three.js"


function addBoxGeometry(x, y, z, color) {
    var boxGeometry = new THREE.BoxGeometry(1, 1, 1);
    var material = new THREE.MeshLambertMaterial({ color });
    var mesh = new THREE.Mesh(boxGeometry, material);
    mesh.position.set(x, y, z);
    return mesh;
}

var scene = new THREE.Scene();

var ambient = new THREE.AmbientLight(0xb1ccd6, 0.5);//环境光
scene.add(ambient);

const light = new THREE.SpotLight(0xffffff, 0.1);//聚光源
light.position.set(-10, 50, 10);
light.castShadow = true;//开启投掷投影
light.shadow.mapSize.width = 2048;
light.shadow.mapSize.height = 2048;
light.shadow.bias = -0.001;

scene.add(light, addBoxGeometry(-10, 50, 10, 0xffffff));//点光源位置物体

//设置阴影分辨率
//xz平面
const __planeGeometry = new THREE.PlaneGeometry(100, 100);
const planeMaterial = new THREE.MeshPhongMaterial({
    color: 0xb1ccd6,
    shininess: 50,
    specular: 0x171717,
    side: THREE.DoubleSide
});

const plane = new THREE.Mesh(__planeGeometry, planeMaterial);
plane.rotateX(Math.PI / 2);//旋转平面至x-z平面
plane.castShadow = true;//开启投掷投影
plane.receiveShadow = true;//接收投影
scene.add(plane);

var directionalLight = new THREE.DirectionalLight(0xffffff, 0.4);//平行光，比如太阳光
directionalLight.position.set(-10, 100, 10);
// directionalLight.castShadow = true;//开启投掷投影
scene.add(directionalLight, addBoxGeometry(-10, 100, 10, 0xffffff));


var PointLight = new THREE.PointLight(0xffffff, 0.1);//点光源
PointLight.position.set(50, 50, -50);
PointLight.castShadow = true;//开启投掷投影
PointLight.shadow.bias = -0.001;
PointLight.shadow.mapSize.width = 2048;
PointLight.shadow.mapSize.height = 2048;
scene.add(PointLight, addBoxGeometry(50, 50, -50, 0xffffff));

// //添加镜面投影
// var palaneSize = 20;
// var mirrorPixelRatio = 2;

// var planeGeometry = new THREE.PlaneBufferGeometry(100, 100);
// var options = {
//     clipBias: 0.03,
//     textureWidth: window.innerWidth * window.devicePixelRatio,
//     textureHeight: window.innerHeight * window.devicePixelRatio,
//     color: 0x777777,
//     recursion: 10,
//     side: THREE.DoubleSide
// }
// var groundMirror = new THREE.Reflector(planeGeometry, options);
// groundMirror.rotateX(Math.PI / 2);//旋转平面至x-z平面
// groundMirror.receiveShadow = true;//接收投影
// groundMirror.castShadow = true;//开启投掷投影
// scene.add(groundMirror);








//坐标辅助系统
var axes = new THREE.AxisHelper(5000);
scene.add(axes);

var width = window.innerWidth;
var height = window.innerHeight;

var ratioWH = width / height; //窗口宽高比
var displayRange = 50; //三维场景显示范围控制系数，系数越大，显示的范围越大

//正射投影 参数 left right up bottom near far
var camera = new THREE.OrthographicCamera(-displayRange * ratioWH, displayRange * ratioWH, displayRange, -displayRange, 1, 1000);

camera.position.set(20, 20, 20); //设置相机位置
camera.lookAt(scene.position); //设置相机方向(指向的场景对象)




var modelFile = "./models/BeiLa/BeiLa.pmx";
var vmdFiles = "./models/201904202121169044.vmd";
var cameraFiles = "Camera.vmd";
var audioFiles = "./models/CUT.mp3";

var onProgress = function (xhr) { console.log((xhr.loaded / xhr.total * 100) + '% loaded') };
var onError = function (err) { console.log("Error Happened. ", err) }

var enableCCDIKHelper = false;//配置-debug-显示骨骼
var enablePhysicsHelper = false;//配置-debug-显示物理刚体

var loader = new THREE.MMDLoader();
var helper = new THREE.MMDAnimationHelper({
    configuration: {
        pmxAnimation: true,
        afterglow: 2.0,
        sync: true
    }
});
var audioListene, sound, raudioLoader;


let DurationData = class {
    totalDuration = {
        animationDuration: 0,
        cameraDuration: 0,
        audioDuration: 0
    }
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
        return this;
    }
}
let durationData = new DurationData()
//new DurationData().update({ vmdDuration: 100, cameraDuration: 200, audioDuration: 300 })


//加载模型文件和动作文件
loader.loadWithAnimation(modelFile, vmdFiles, function (object) {
    console.log("==>Mesh: ", object)

    //模型开启投掷投影，接收投影
    object.mesh.castShadow = true;
    object.mesh.receiveShadow = true;

    durationData.update({ animationDuration: object.animation.duration });

    //添加SkinnedMesh到helper
    helper.add(object.mesh,
        {
            animation: object.animation,
            physics: true
        });
    scene.add(object.mesh);

    //加载音频文件
    audioListener = new THREE.AudioListener();
    camera.add(audioListener);
    sound = new THREE.Audio(audioListener);

    const audioLoader = new THREE.AudioLoader();
    audioLoader.load(audioFiles, function (audioBuffer) {
        sound.setBuffer(audioBuffer);
        //添加音频到helper
        var audioParams = {
            delayTime: 0.0
        }
        helper.add(sound, audioParams);
        durationData.update({ audioDuration: object.animation.duration });
    }, onProgress, onError);


    //加载镜头
    // loader.loadVmds( cameraFiles, function ( vmd ) {
    //     helper.setCamera( myMmdScen.camera );
    //     loader.pourVmdIntoCamera( myMmdScen.camera, vmd );
    //     helper.setCameraAnimation( myMmdScen.camera );
    // }

    // helper.setAnimation(object.animation);
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

var renderer = new THREE.WebGLRenderer({
    antialias: true,
    alpha: true,
    logarithmicDepthBuffer: true
});
renderer.shadowMap.enabled = true;//开启阴影设置
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.shadowMap.renderSingleSided = false;
renderer.shadowMap.renderReverseSided = false;
renderer.setPixelRatio(window.devicePixelRatio);

renderer.setSize(width, height);
renderer.setClearColor(0x000000, 1);
document.body.appendChild(renderer.domElement);

const container = document.createElement('div');
document.body.appendChild(container);
stats = new Stats();
container.appendChild(stats.dom);

renderer.render(scene, camera);


// //添加天空
// var sky = new THREE.Sky();
// sky.scale.setScalar(450000);
// scene.add(sky);
// sun = new THREE.Vector3();

// const effectController = {
//     turbidity: 10,
//     rayleigh: 3,
//     mieCoefficient: 0.005,
//     mieDirectionalG: 0.7,
//     elevation: 2,
//     azimuth: 180,
//     exposure: renderer.toneMappingExposure
// };
// const uniforms = sky.material.uniforms;
// uniforms[ 'turbidity' ].value = effectController.turbidity;
// uniforms[ 'rayleigh' ].value = effectController.rayleigh;
// uniforms[ 'mieCoefficient' ].value = effectController.mieCoefficient;
// uniforms[ 'mieDirectionalG' ].value = effectController.mieDirectionalG;

// const phi = THREE.MathUtils.degToRad( 90 - effectController.elevation );
// const theta = THREE.MathUtils.degToRad( effectController.azimuth );

// sun.setFromSphericalCoords( 1, phi, theta );

// uniforms[ 'sunPosition' ].value.copy( sun );

// renderer.toneMappingExposure = effectController.exposure;




var clock = new THREE.Clock();

let playStatus = "play";//播放状态
let totalTime = 0;//当前mmd播放时间

var enablePhysicWhenMMDPause = true;//配置-暂停时包含物理动作帧

function animation(RenderType) {

    let timeDelta = clock.getDelta();
    totalTime += timeDelta;
    // console.log(timeDelta, totalTime);
    renderer.setSize(window.innerWidth, window.innerHeight);
    fixCameraRatio();

    if (RenderType == 'ControlRender') {
        stats.update();
        renderer.render(scene, camera);
        if (enablePhysicWhenMMDPause == true) {
            helper.update(0);//暂停时包含物理动作帧
        }
    } else if (RenderType == 'NotRender') {
        console.log("MMD渲染帧完全关闭");
    } else if (RenderType == undefined || RenderType == null) {
        stats.update();
        helper.update(timeDelta);
        renderer.render(scene, camera);
    }
}

var renderFPS = 100;//配置-设置渲染帧率
var renderIntervalID = setInterval(() => {
    animation();
}, 1000 / renderFPS);

// animateRenderID = requestAnimationFrame(animation);
var controls = new THREE.OrbitControls(camera, renderer.domElement);//创建控件对象
controls.addEventListener('change', function () {
    if (playStatus != "pause") {
        clearInterval(renderIntervalID);
        animation();
        renderIntervalID = setInterval(() => { animation() }, 1000 / renderFPS);
        console.log("场景控制插入帧渲染", renderIntervalID);
    }
});//监听鼠标、键盘事件

//不在此页面时暂停，减少算力资源消耗
var enablePauseWhenLeaveCurrentPage = true;//配置-启用离开页面暂停
var beforeVisibilityChangePlayStatus = { visible: String, hidden: String }; //在有页面隐藏和显示前的播放状态
function visibilityChangePlayPauseManager(status) {
    //不在此页面时暂停，减少算力资源消耗
    var visibilityChangePlayPause = function () {
        console.log(document.webkitVisibilityState);
        if (document.webkitVisibilityState == "visible") {
            beforeVisibilityChangePlayStatus.hidden = playStatus;
            PlayPause("play", 'v');
        }
        else {
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
    // console.log(args, beforeVisibilityChangePlayStatus);
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
        var ratioWH = window.innerWidth / window.innerHeight;
        camera.top = displayRange
        camera.bottom = -displayRange
        camera.left = -displayRange * ratioWH
        camera.right = displayRange * ratioWH
        camera.updateProjectionMatrix();//重新计算投影矩阵
        console.log("重新计算投影矩阵");
    }
}

