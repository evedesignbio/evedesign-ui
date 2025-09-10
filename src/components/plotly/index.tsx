// @ts-ignore
import Plotly from "plotly.js-gl2d-dist";
// @ts-ignore
import createPlotlyComponent from "react-plotly.js/factory";
import "./index.css"; // hide panels

Plotly.setPlotConfig({logging: 0})
export const Plot = createPlotlyComponent(Plotly);