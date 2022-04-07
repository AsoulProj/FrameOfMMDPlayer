//! Scene 环境部分
var scene = new THREE.Scene();

/* 功能-添加辅助物体 */
function addBoxGeometry(x, y, z, color) {
    var boxGeometry = new THREE.BoxGeometry(1, 1, 1);
    var material = new THREE.MeshLambertMaterial({ color });
    var mesh = new THREE.Mesh(boxGeometry, material);
    mesh.position.set(x, y, z);
    return mesh;
}

/* 添加环境光 */
var ambient = new THREE.AmbientLight(0xffffff, 0.8); //环境光
scene.add(ambient);

/* 添加平面 */
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

/* 添加坐标辅助系统 */
var axes = new THREE.AxisHelper(5000);
scene.add(axes);


//! Camera 摄像机部分
var camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 1, 10000);
camera.position.set(20, 20, 20); //设置相机位置
camera.lookAt(scene.position); //设置相机方向(指向的场景对象)


//! Renderer 渲染器部分
var renderer = new THREE.WebGL1Renderer({
    antialias: true, //抗锯齿
    alpha: true, //???
});

renderer.setPixelRatio(window.devicePixelRatio);
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setClearColor(0x000000, 1);
renderer.shadowMap.enabled = true; //开启阴影设置
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
document.body.appendChild(renderer.domElement);

//!待添加动画的回调函数
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

var playerConfiguration = {
    mmdFilesPath: {
        modelFile: "./models/LuoTianyi/luotianyi_v4_ver2.0.pmx",
        motionFile: "./models/201904202121169044.vmd",
        audioFile: "./models/CUT.mp3"
    },
    renderFPS: 100,
    enablePhysicWhenMMDPause: true,
    enablePauseWhenLeaveCurrentPage: true
}

let playManager = new MMDPlayManager(playerConfiguration);
playManager.onLoad(() => { console.log("文件加载完成"); })