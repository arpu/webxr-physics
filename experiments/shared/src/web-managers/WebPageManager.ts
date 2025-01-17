import {PerspectiveCamera, Scene, WebGLRenderer} from 'three';
import TrackballControls from 'three-trackballcontrols';
import {SceneManagerInterface} from '../scene/SceneManagerInterface';
import PhysicsHandler from '../physics/physicsHandler';

export default class WebPageManager {
  private readonly camera: PerspectiveCamera;
  private renderer: WebGLRenderer;
  private readonly scene: Scene;
  private sceneBuilder: SceneManagerInterface;
  private controls: TrackballControls;

  constructor(sceneManager: SceneManagerInterface) {
    let $this = this;
    function render() {
      $this.renderer.setAnimationLoop(render);
      $this.sceneBuilder.update();
      $this.controls.update();
      $this.renderer.render($this.scene, $this.camera);
    }
    this.sceneBuilder = sceneManager;
    this.scene = new Scene();
    this.camera = new PerspectiveCamera();
    this.scene.add(this.camera);
    this.camera.position.set(1, 1, 1);
    this.renderer = new WebGLRenderer({alpha: false});
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.autoClear = false;
    this.sceneBuilder.build(this.camera, this.scene, this.renderer.capabilities.getMaxAnisotropy(), new PhysicsHandler(), null);
    this.addTrackBallControls();
    this.addOutputToPage();
    window.addEventListener( 'resize', this.onWindowResize, false );
    render();
  }

  private addTrackBallControls() {
    this.controls = new TrackballControls(this.camera, this.renderer.domElement);
  }

  private addOutputToPage = () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    container.appendChild(this.renderer.domElement);
  };

  private onWindowResize = () => {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize( window.innerWidth, window.innerHeight );
  }
}

