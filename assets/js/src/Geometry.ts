import {Vector3} from "three";

const DEG2RAD = Math.PI / 180;
const RAD2DEG = 180 / Math.PI;

export interface IGeoCoords {
    lat: number,
    long: number,
}

/**
 * Find the great-circle distance
 *
 * @param startCoord
 * @param endCoord
 */
export const getGreatCircleDistance = (startCoord: IGeoCoords, endCoord: IGeoCoords): number => {

    const phi1 = startCoord.lat * DEG2RAD;
    const phi2 = endCoord.lat * DEG2RAD;

    const deltaPhi = (endCoord.lat - startCoord.lat) * DEG2RAD;
    const deltaLambda = (endCoord.long - startCoord.long) * DEG2RAD;

    return (2 * Math.asin(Math.sqrt(hav(deltaPhi) + Math.cos(phi1) * Math.cos(phi2) * hav(deltaLambda))));
}

/**
 * Compute a way point given a start and end coordinate and a fraction of the distance
 *
 * https://www.movable-type.co.uk/scripts/latlong.html
 *
 * @param startCoord
 * @param endCoord
 * @param fraction
 */
export const getSphericalWayPoint = (startCoord: IGeoCoords, endCoord: IGeoCoords, fraction: number): IGeoCoords => {
    const distance = getGreatCircleDistance(startCoord, endCoord);

    if(distance === 0) return startCoord;

    const a = Math.sin((1 - fraction) * distance) / Math.sin(distance)
    const b = Math.sin(fraction * distance) / Math.sin(distance)

    const x = a * Math.cos(startCoord.lat * DEG2RAD) * Math.cos(startCoord.long * DEG2RAD)
      + b * Math.cos(endCoord.lat * DEG2RAD) * Math.cos(endCoord.long * DEG2RAD);

    const y = a * Math.cos(startCoord.lat * DEG2RAD) * Math.sin(startCoord.long * DEG2RAD)
      + b * Math.cos(endCoord.lat * DEG2RAD) * Math.sin(endCoord.long * DEG2RAD);

    const z = a * Math.sin(startCoord.lat * DEG2RAD) + b * Math.sin(endCoord.lat * DEG2RAD);

    return {
        lat: Math.atan2(z, Math.sqrt(Math.pow(x, 2) + Math.pow(y, 2))) * RAD2DEG,
        long: Math.atan2(y, x) * RAD2DEG
    }
}

/**
 * Compute the haversine of theta
 * hav(theta) = sin(theta/2)^2
 *
 * @param theta
 */
export const hav = (theta: number): number => {
    return Math.pow(Math.sin(theta / 2), 2);
}

/**
 * Latitude and longitude to cartesian
 *
 * http://sites.science.oregonstate.edu/math/home/programs/undergrad/CalculusQuestStudyGuides/vcalc/coord/coord.html
 * https://stackoverflow.com/questions/48240677/how-to-get-lat-long-values-of-point-at-center-of-screen-in-webgl-globe
 * https://github.com/dataarts/webgl-globe/blob/master/globe/globe.js
 *
 * @param coord
 * @param radius (rho)
 * @private
 */
export const toCartesian = (coord: IGeoCoords, radius: number): Vector3 => {
    const phi = (90 - coord.lat) * DEG2RAD;
    const theta = (coord.long + 180) * DEG2RAD;

    const x = (radius * Math.sin(phi) * Math.cos(theta)) * -1;
    const y = radius * Math.cos(phi);
    const z = radius * Math.sin(phi) * Math.sin(theta);

    return new Vector3(x, y, z);
}