import {
    WebGLRenderer,
    Scene,
    PerspectiveCamera,
    MeshBasicMaterial,
    SphereGeometry,
    TextureLoader,
    DoubleSide,
    Mesh,
} from "three";
import {OrbitControls} from "three/examples/jsm/controls/OrbitControls";

import worldMap from "./assets/world_map.png";

export interface ICamera {
    positionX?: number,
    positionY?: number,
    positionZ?: number,
}

export interface IOptions {
    rotateSpeed?: number,
    autoRotate?: boolean,
    autoRotateSpeed?: number,
    minPolarAngle?: number,
    maxPolarAngle?: number,
    camera?: ICamera,
    // Should be an equirectangular projection
    worldMap?: string,
}

const defaultOptions: IOptions = {
    rotateSpeed: 0.35,
    autoRotate: true,
    autoRotateSpeed: 0.5,
    // Hide the poles from view
    // 45deg
    minPolarAngle: Math.PI / 4,
    // 120deg, account for South America is further from pole than Europe
    maxPolarAngle: (2 * Math.PI) / 3,
    camera: {
        positionY: 105,
        positionZ: 260,
    },
    worldMap: worldMap,
}

class Globe {

    protected container: HTMLDivElement;
    protected canvas: HTMLCanvasElement;

    protected width: number;
    protected height: number;

    protected renderer: WebGLRenderer;
    protected scene: Scene;
    protected camera: PerspectiveCamera;
    protected orbitControls: OrbitControls;
    protected lastRender: number;

    protected worldMap: string;

    /**
     * @param {HTMLDivElement} container
     * @param {number} width
     * @param {number} height
     * @param {IOptions} options
     */
    constructor(container: HTMLDivElement, width: number, height: number, options?: IOptions) {
        options = { ...defaultOptions, ...options };

        this.container = container;

        const canvas = document.createElement('canvas');
        container.appendChild(canvas);

        this.canvas = canvas;

        if(!this.checkWebGL()){
            throw new Error("This browser does not support WebGL.");
        }

        this.width = width;
        this.height = height;

        this.scene = new Scene();
        this.camera = new PerspectiveCamera(45, width / height);
        this.renderer = new WebGLRenderer({
            canvas: canvas,
            alpha: true,
        });

        this.renderer.setSize(width, height);

        this.orbitControls = new OrbitControls(this.camera, this.canvas);
        this.orbitControls.enableKeys = false;
        this.orbitControls.enablePan = false;

        this.orbitControls.enableZoom = false;
        this.orbitControls.enableDamping = false;
        this.orbitControls.enableRotate = true;

        if(options.rotateSpeed)
            this.orbitControls.rotateSpeed = options.rotateSpeed;

        if(options.autoRotate)
            this.orbitControls.autoRotate = options.autoRotate;

        if(options.autoRotateSpeed)
            this.orbitControls.autoRotateSpeed = options.autoRotateSpeed;

        if(options.minPolarAngle)
            this.orbitControls.minPolarAngle = options.minPolarAngle;

        if(options.maxPolarAngle)
            this.orbitControls.maxPolarAngle = options.maxPolarAngle;

        if(options.camera && options.camera.positionX)
            this.camera.position.x = options.camera.positionX;

        if(options.camera && options.camera.positionY)
            this.camera.position.y = options.camera.positionY;

        if(options.camera && options.camera.positionZ)
            this.camera.position.z = options.camera.positionZ;

        if(options.worldMap)
            this.worldMap = options.worldMap;
        else
            throw new Error("World map texture needed.")

        this.addSphere();

        this.lastRender = 0;
    }

    private addSphere(): void {
        const landGeometry = new SphereGeometry(100, 32, 32);

        const loader = new TextureLoader();
        const texture = loader.load(this.worldMap);

        // Correct the projection of a flat texture on a sphere
        texture.anisotropy = 10;

        const landMaterial = new MeshBasicMaterial({
            map: texture,
            transparent: true,
            side: DoubleSide,
            depthWrite: false,
        });

        landMaterial.needsUpdate = true;

        const landSphere = new Mesh(landGeometry, landMaterial);
        this.scene.add(landSphere);

        const oceanMaterial = new MeshBasicMaterial({
            color: 0xfefefef,
        });

        oceanMaterial.needsUpdate = true;

        const oceanGeometry = new SphereGeometry(97, 32, 32);

        const oceanSphere = new Mesh(oceanGeometry, oceanMaterial);

        this.scene.add(oceanSphere);
    }

    private checkWebGL() {
        return this.canvas.getContext("webgl") || this.canvas.getContext("experimental-webgl")
    }

    /**
     * Render the globe.
     *
     * If creating your own render function, put your functions in the if statement
     *
     * @return {void}
     */
    public render(): void {
        // Update the animation
        requestAnimationFrame(this.render.bind(this));

        let frameRate = 24;
        let now = Date.now();
        let elapsed = now - this.lastRender;

        if(elapsed > frameRate){
            this.lastRender = now - (elapsed % frameRate);

            // Update sphere
            this.orbitControls.update();

            this.renderer.render(this.scene, this.camera);
        }
    }

    /**
     * Disposes the globe.
     *
     * @return {void}
     */
    public dispose(): void {
        this.renderer.dispose();
    }
}

export default Globe;