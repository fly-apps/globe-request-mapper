// We need to import the CSS so that webpack will load it.
// The MiniCssExtractPlugin is used to separate it out into
// its own CSS file.
import "../css/app.scss"

// webpack automatically bundles all modules in your
// entry points. Those entry points can be configured
// in "webpack.config.js".
//
// Import deps with the dep name or local files with a relative path, for example:
//
//     import {Socket} from "phoenix"
//     import socket from "./socket"
//
import "phoenix_html"
import {Socket} from "phoenix"
import topbar from "topbar"
import {LiveSocket} from "phoenix_live_view"
import DataCenterGlobe from "./src/DataCenterGlobe";

const globeContainer = document.getElementById("globe");

const globe = new DataCenterGlobe(globeContainer, 500, 500);

let Hooks = {}
Hooks.Globe = {
    mounted() {
        this.handleEvent("my_coords", this.myCoords)
        this.handleEvent("data_centers", this.dataCenters)
        this.handleEvent("request", this.request)
    },
    myCoords: ({coords}) => {
        globe.plotMyCoordinates(coords);
        globe.focusCamera(coords);
        globe.render();
    },
    dataCenters: ({data_centers: dataCenters}) => {
        globe.setDataCenters(dataCenters);
    },
    request: ({request}) => {
        globe.addCurve(request.from, request.to)
    },
}

let csrfToken = document.querySelector("meta[name='csrf-token']").getAttribute("content");
let liveSocket = new LiveSocket("/live", Socket, {
    hooks: Hooks,
    params: {_csrf_token: csrfToken}
});

// Show progress bar on live navigation and form submits
topbar.config({barColors: {0: "#29d"}, shadowColor: "rgba(0, 0, 0, .3)"});
window.addEventListener("phx:page-loading-start", info => topbar.show());
window.addEventListener("phx:page-loading-stop", info => topbar.hide());

// connect if there are any LiveViews on the page
liveSocket.connect();

// expose liveSocket on window for web console debug logs and latency simulation:
// >> liveSocket.enableDebug()
// >> liveSocket.enableLatencySim(1000)  // enabled for duration of browser session
// >> liveSocket.disableLatencySim()
window.liveSocket = liveSocket
