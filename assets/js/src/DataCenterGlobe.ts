import {
    BoxGeometry,
    CubicBezierCurve3,
    Line,
    Mesh,
    MeshBasicMaterial,
    TubeBufferGeometry
} from "three";

import Globe, { IOptions } from "./globe/Globe";
import * as Geometry from "./Geometry";

interface IDataCenter {
    code: string,
    coords: Geometry.IGeoCoords,
}

interface IRequest {
    line: Line<TubeBufferGeometry, MeshBasicMaterial>,
    step: number,
    max: number,
}

class DataCenterGlobe extends Globe {

    protected requests: Array<IRequest>;

    protected dataCenters: Array<Mesh<BoxGeometry, MeshBasicMaterial>>

    constructor(container: HTMLDivElement, width: number, height: number, options?: IOptions) {
        super(container, width, height, options);

        this.requests = [];
        this.dataCenters = [];
    }

    /**
     * Place cubes on the globe where the data centers are
     *
     * @private
     */
    public setDataCenters(dataCenters: IDataCenter[]) {
        const boxGeometry = new BoxGeometry(1, 2, 2);
        const boxMaterial = new MeshBasicMaterial({
            color: 0x3B23F7,
        });
        
        this.dataCenters.forEach(dataCenter => {
            this.scene.remove(dataCenter);
        });

        this.dataCenters = [];

        // plot on sphere
        dataCenters.forEach(location => {
            const dataCenter = new Mesh(boxGeometry, boxMaterial);
            dataCenter.position.copy(Geometry.toCartesian(location.coords, 100));

            this.scene.add(dataCenter);
            this.dataCenters.push(dataCenter)
        });
    }

    /**
     * Place cubes on the globe where the data centers are
     *
     * @private
     */
    public plotMyCoordinates(coords: Geometry.IGeoCoords) {
        const boxGeometry = new BoxGeometry(1, 1, 2);
        const boxMaterial = new MeshBasicMaterial({
            color: 0xF72E23,
        });

        const myMesh = new Mesh(boxGeometry, boxMaterial);
        myMesh.position.copy(Geometry.toCartesian(coords, 100));

        this.scene.add(myMesh);
    }

    /**
     * Focus on point on sphere
     *
     * @param coord
     */
    public focusCamera(coord: Geometry.IGeoCoords) {
        const point = Geometry.toCartesian(coord, 200);

        let altitude = 30;
        let coeff = 1 + altitude / 50;

        this.camera.position.x = point.x * coeff;
        this.camera.position.y = point.y * coeff;
        this.camera.position.z = point.z * coeff;

        this.camera.lookAt(point);
        this.orbitControls.update();
    }

    /**
     * Plot a curve on the globe
     *
     * @param {Geometry.IGeoCoords} startCoord
     * @param {Geometry.IGeoCoords} endCoord
     * @private
     */
    public addCurve(startCoord: Geometry.IGeoCoords, endCoord: Geometry.IGeoCoords) {

        // https://en.wikipedia.org/wiki/Great-circle_distance
        // Get distance, find way points, create a curve with additional altitude

        const startCartesian = Geometry.toCartesian(startCoord, 100);
        const endCartesian = Geometry.toCartesian(endCoord, 100);

        let altitude = 45;

        // Longer the distance, higher the altitude
        const distance = Geometry.getGreatCircleDistance(startCoord, endCoord);

        switch (true) {
            case (distance > (Math.PI * (0.85))):
                altitude = 90;
                break;
            case (distance > (Math.PI * (0.75))):
                altitude = 70;
                break;
            case (distance > (Math.PI * (0.65))):
                altitude = 60;
                break;
        }

        const ctrl1 = Geometry.toCartesian(Geometry.getSphericalWayPoint(startCoord, endCoord, 0.25), 100 + altitude);
        const ctrl2 = Geometry.toCartesian(Geometry.getSphericalWayPoint(startCoord, endCoord, 0.75), 100 + altitude);

        const curve = new CubicBezierCurve3(
            startCartesian,
            ctrl1,
            ctrl2,
            endCartesian,
        );

        const tubeGeometry = new TubeBufferGeometry(curve, 5, 0.25, 8, false);

        const tubeMaterial = new MeshBasicMaterial({
            color: 0x707070,
        });

        const curveObject = new Line(tubeGeometry, tubeMaterial);
        this.scene.add(curveObject);

        // Add request to array for renderer to manage
        this.requests.push({
            line: curveObject,
            step: 0,
            max: tubeGeometry.attributes.position.count,
        });
    }

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

            // For each existing request, draw the request until completion, then remove
            this.requests.forEach(({line, step, max }, i, object) => {
                if(step < (max * 5)){
                    step += 10;
                    line.geometry.setDrawRange(0, step);
                    object[i].step = step;
                }else{
                    this.scene.remove(line);
                    object.splice(i, 1);
                }
            });

            this.renderer.render(this.scene, this.camera);
        }
    }
}

export default DataCenterGlobe;