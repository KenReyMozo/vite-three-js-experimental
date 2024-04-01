import * as THREE from 'three';
import { MTLLoader, OBJLoader } from 'three/examples/jsm/Addons.js';
import Bullet from './Bullet';
import * as CANNON from 'cannon';
import Ground from './Ground';
import { ThreeVec3ToCannonVec3 } from '../helper/vector';
import BouncyBox from './BouncyBox';

export default class BlasterScene extends THREE.Scene {
  private readonly mtlLoader = new MTLLoader();
  private readonly objLoader = new OBJLoader();

  private readonly camera: THREE.PerspectiveCamera;

  private blaster?: THREE.Group;
  private bulletMtl?: MTLLoader.MaterialCreator;

  private keyDown = new Set<string>();
  private directionVector = new THREE.Vector3();

  private bullets: Bullet[] = [];
  private targets: THREE.Group[] = [];

  private bouncyBoxes: BouncyBox[] = [];

  private physicsWorld: CANNON.World;

  constructor(camera: THREE.PerspectiveCamera, physicsWorld: CANNON.World) {
    super();
    this.camera = camera;

    this.physicsWorld = physicsWorld;

  }

  async init() {

    const xAxis = new THREE.ArrowHelper(new THREE.Vector3(1, 0, 0), new THREE.Vector3(), 10, 0xff0000);
    const yAxis = new THREE.ArrowHelper(new THREE.Vector3(0, 1, 0), new THREE.Vector3(), 10, 0x00ff00);
    const zAxis = new THREE.ArrowHelper(new THREE.Vector3(0, 0, 1), new THREE.Vector3(), 10, 0x0000ff);

    this.add(xAxis);
    this.add(yAxis);
    this.add(zAxis);

    const test = new CANNON.Vec3(1, 1, 1);

    const xAxisC = new THREE.ArrowHelper(new THREE.Vector3(test.x, 0, 0), new THREE.Vector3(1,1,1), 10, 0xff0000);
    const yAxisC = new THREE.ArrowHelper(new THREE.Vector3(0, test.y, 0), new THREE.Vector3(1,1,1), 10, 0x00ff00);
    const zAxisC = new THREE.ArrowHelper(new THREE.Vector3(0, 0, test.z), new THREE.Vector3(1,1,1), 10, 0x0000ff);

    this.add(xAxisC);
    this.add(yAxisC);
    this.add(zAxisC);

    new Ground(this, this.physicsWorld, 100, 100);

    const targetMtl = await this.mtlLoader.loadAsync('assets/targetA.mtl');
    targetMtl.preload();

    this.bulletMtl = await this.mtlLoader.loadAsync('assets/foamBulletB.mtl');
    this.bulletMtl.preload();

    const t1 = await this.createTarget(targetMtl);
    t1.position.x = -1;
    t1.position.z = -3;
    const t2 = await this.createTarget(targetMtl);
    t2.position.x = 0;
    t2.position.z = -3;
    const t3 = await this.createTarget(targetMtl);
    t3.position.x = 1;
    t3.position.z = -3;
    const t4 = await this.createTarget(targetMtl);
    t4.position.x = 2;
    t4.position.z = -3;

    this.add(t1, t2, t3, t4);
    this.targets.push(t1, t2, t3, t4);

    this.blaster = await this.createBlaster();
    this.add(this.blaster);

    this.blaster.position.z = 3;
    this.blaster.add(this.camera);

    this.camera.position.z = 1;
    this.camera.position.y = 0.5;

    const light = new THREE.DirectionalLight(0xFFFFFF, 1);
    light.position.set(0, 4, 2);
    this.add(light);
    const ambientLight = new THREE.AmbientLight(0xffffff, 1);
    this.add(ambientLight);
    document.addEventListener('keydown', this.handleKeyDown.bind(this));
    document.addEventListener('keyup', this.handleKeyUp.bind(this));
  }

  private handleKeyDown(event: KeyboardEvent) {
    this.keyDown.add(event.key.toLowerCase());
  }

  private handleKeyUp(event: KeyboardEvent) {
    this.keyDown.delete(event.key.toLowerCase());

    if (event.key === ' ') {
      this.createBullet();
    }
  }

  private async createBullet() {
    if (!this.blaster || !this.bulletMtl) return;

    this.objLoader.setMaterials(this.bulletMtl);

    const bulletModel = await this.objLoader.loadAsync('assets/foamBulletB.obj');

    this.camera.getWorldDirection(this.directionVector);

    const aabb = new THREE.Box3().setFromObject(this.blaster);
    const size = aabb.getSize(new THREE.Vector3());

    const vec = this.blaster.position.clone();
    vec.y += 0.06;

    bulletModel.position.add(
      vec.add(
        this.directionVector.clone().multiplyScalar(size.z * 0.5)
      )
    )

    bulletModel.children.forEach(child => child.rotateX(Math.PI * -0.5));
    bulletModel.rotation.copy(this.blaster.rotation);

    this.add(bulletModel);

    const b = new Bullet(bulletModel);
    b.setVelocity(
      this.directionVector.x * 0.2,
      this.directionVector.y * 0.2,
      this.directionVector.z * 0.2
    )

    this.bullets.push(b);
  }

  private async createTarget(mtl: MTLLoader.MaterialCreator) {
    this.objLoader.setMaterials(mtl);
    const modelRoot = await this.objLoader.loadAsync('assets/targetA.obj');
    modelRoot.rotateY(Math.PI * 0.5);

    return modelRoot;
  }

  private async createBlaster() {
    const mtl = await this.mtlLoader.loadAsync('assets/blasterG.mtl');
    mtl.preload();

    this.objLoader.setMaterials(mtl);
    const modelRoot = await this.objLoader.loadAsync('assets/blasterG.obj');

    return modelRoot;
  }


  private updateInput(){
    if(!this.blaster) return;

    const shiftKey = this.keyDown.has('shift');
    if(!shiftKey) {
      if(this.keyDown.has('a') || this.keyDown.has('arrowleft'))
        this.blaster.rotateY(0.02);
      if(this.keyDown.has('d') || this.keyDown.has('arrowright'))
        this.blaster.rotateY(-0.02);
    }

    const dir = this.directionVector;

    this.camera.getWorldDirection(dir);

    const speed = 0.1;

    if(this.keyDown.has('w') || this.keyDown.has('arrowup')){
      this.blaster.position.add(dir.clone().multiplyScalar(speed));
    }
    else if (this.keyDown.has('s') || this.keyDown.has('arrowdown')) {
      this.blaster.position.add(dir.clone().multiplyScalar(-speed));
    }

    if(shiftKey){
      const strafeDir = dir.clone();
      const upVector = new THREE.Vector3(0, 1, 0);
      
      if(this.keyDown.has('a') || this.keyDown.has('arrowleft'))
        this.blaster.position.add(
          strafeDir.applyAxisAngle(upVector, Math.PI * 0.5).multiplyScalar(speed)
      )
      else if(this.keyDown.has('d') || this.keyDown.has('arrowright'))
        this.blaster.position.add(
          strafeDir.applyAxisAngle(upVector, Math.PI * -0.5).multiplyScalar(speed)
      )
    }
  }


  private updateBullets() {
    for (let i = 0; i < this.bullets.length; ++i) {
      const b = this.bullets[i];
      b.update();

      if (b.shouldRemove) {
        this.remove(b.group);
        this.bullets.splice(i, 1);
        i--;
      } else {
        for (let j = 0; j < this.targets.length; ++j) {
          const target = this.targets[j];
          if (target.position.distanceToSquared(b.group.position) < 0.05) {
            // Handle bullet hit
            this.remove(b.group);
            const newVec3 = ThreeVec3ToCannonVec3(target.position);
            const box = new BouncyBox(this, this.physicsWorld, new THREE.Vector3(.2, .2, .2), new THREE.Vector3(newVec3.x, newVec3.y+1, newVec3.z))
            this.bouncyBoxes.push(box);
            this.bullets.splice(i, 1);
            i--;

            target.visible = false;
            setTimeout(() => {
              target.visible = true;
            }, 1000);
          }
        }
      }
    }
  }

  update() {
    this.updateBullets();
    this.updateInput();
    this.bouncyBoxes.forEach(box => box.update());
  }

  private updatePhysics() {
    // Step the Cannon.js physics simulation
    const fixedTimeStep = 1 / 60; // 60 fps
    this.physicsWorld.step(fixedTimeStep, undefined, undefined);
  }


  tick() {
    this.update();
    this.updatePhysics();
  }
}
