import * as Geometry from "../src/Geometry";

describe('Test geometry for rendering on sphere', () => {
    const londonCoord: Geometry.IGeoCoords = {
        lat: 51.509865,
        long: -0.118092,
    }

    const berlinCoord: Geometry.IGeoCoords = {
        lat: 52.520008,
        long: 13.404954,
    }

    const newYorkCoord: Geometry.IGeoCoords = {
        lat: 40.785091,
        long: -73.968285,
    }

    const melbourneCoord: Geometry.IGeoCoords = {
        lat: -37.840935,
        long: 144.946457,
    }

    const aucklandCoord: Geometry.IGeoCoords = {
        lat: -36.848461,
        long: 174.763336,
    }

    it("Calculates distance on great circle",  () => {
        expect(Geometry.getGreatCircleDistance(londonCoord, melbourneCoord)).toBeCloseTo(2.65324, 5);
        expect(Geometry.getGreatCircleDistance(berlinCoord, newYorkCoord)).toBeCloseTo(1.00096, 5);
        expect(Geometry.getGreatCircleDistance(newYorkCoord, aucklandCoord)).toBeCloseTo(2.22878, 5);
        expect(Geometry.getGreatCircleDistance(newYorkCoord, newYorkCoord)).toEqual(0);
    });

    it("Calculates way points",  () => {
        expect(Geometry.getSphericalWayPoint(berlinCoord, newYorkCoord, 0).lat)
            .toBeCloseTo(52.520008, 5);
        expect(Geometry.getSphericalWayPoint(berlinCoord, newYorkCoord, 0).long)
            .toBeCloseTo(13.404954, 5);

        expect(Geometry.getSphericalWayPoint(berlinCoord, newYorkCoord, 0.25).lat)
            .toBeCloseTo(56.62137, 5);
        expect(Geometry.getSphericalWayPoint(berlinCoord, newYorkCoord, 0.25).long)
            .toBeCloseTo(-10.44480, 5);

        expect(Geometry.getSphericalWayPoint(berlinCoord, newYorkCoord, 0.33).lat)
            .toBeCloseTo(56.86414, 5);
        expect(Geometry.getSphericalWayPoint(berlinCoord, newYorkCoord, 0.33).long)
            .toBeCloseTo(-18.80464, 5);

        expect(Geometry.getSphericalWayPoint(berlinCoord, newYorkCoord, 0.75).lat)
            .toBeCloseTo(49.69626, 5);
        expect(Geometry.getSphericalWayPoint(berlinCoord, newYorkCoord, 0.75).long)
            .toBeCloseTo(-57.92408, 5);

        expect(Geometry.getSphericalWayPoint(berlinCoord, newYorkCoord, 1).lat)
            .toBeCloseTo(40.785091, 5);
        expect(Geometry.getSphericalWayPoint(berlinCoord, newYorkCoord, 1).long)
            .toBeCloseTo(-73.968285, 5);
    });

    it("Calculates haversine",  () => {
        expect(Geometry.hav(50))
            .toBeCloseTo(0.017517, 5);
    })

    it("Convert to cartesian from coordinates and radius",  () => {
        expect(Geometry.toCartesian(berlinCoord, 50).x)
            .toBeCloseTo(29.59534, 5);
        expect(Geometry.toCartesian(berlinCoord, 50).y)
            .toBeCloseTo(39.67829, 5);
        expect(Geometry.toCartesian(berlinCoord, 50).z)
            .toBeCloseTo(-7.05331, 5);

        expect(Geometry.toCartesian(newYorkCoord, 0).x)
            .toEqual(0);
        expect(Geometry.toCartesian(newYorkCoord, 0).y)
            .toEqual(0);
        expect(Geometry.toCartesian(newYorkCoord, 0).z)
            .toEqual(0);
    })
});