class MapVisual {
    constructor(_parentElement, _data, _title, singaporeGeoJSON, _onUpdate) {
        this.parentElement = _parentElement;
        this.data = _data;
        this.title = _title;
        this.onUpdate = _onUpdate;
        this.singaporeGeoJSON = singaporeGeoJSON;

        this.initVis();
    }

    initVis() {
        const vis = this;

        vis.MARGIN = { LEFT: 0, RIGHT: 10, TOP: 50, BOTTOM: 50 };
        vis.WIDTH = 500 - vis.MARGIN.LEFT - vis.MARGIN.RIGHT;
        vis.HEIGHT = 350 - vis.MARGIN.TOP - vis.MARGIN.BOTTOM;

        // SVG setup
        vis.svg = d3.select(vis.parentElement).append("svg")
            .attr("width", vis.WIDTH + vis.MARGIN.LEFT + vis.MARGIN.RIGHT)
            .attr("height", vis.HEIGHT + vis.MARGIN.TOP + vis.MARGIN.BOTTOM)
            .append("g")
            .attr("transform", `translate(${vis.MARGIN.LEFT}, ${vis.MARGIN.TOP})`);

        vis.projection = d3.geoMercator()
            .center([103.8198, 1.3521])
            .scale(50000)
            .translate([vis.WIDTH / 2, vis.HEIGHT / 2]);

        vis.path = d3.geoPath().projection(vis.projection);

        vis.tooltip = d3.select(vis.parentElement)
            .append("div")
            .attr("class", "tooltip")
            .style("position", "absolute")
            .style("background-color", "rgba(0, 0, 0, 0.7)")
            .style("color", "#fff")
            .style("padding", "5px")
            .style("border-radius", "5px")
            .style("visibility", "hidden");

        vis.svg.append("text")
            .attr("class", "map-title")
            .attr("x", vis.WIDTH / 2)
            .attr("y", -10)
            .attr("text-anchor", "middle")
            .style("font-size", "16px")
            .style("font-weight", "bold");

        // Load GeoJSON and initialize the map
        d3.json("district_and_planning_area.geojson").then(singaporeGeoJSON => {
            vis.singaporeGeoJSON = singaporeGeoJSON.features;

            // Initial rendering with default dataType
            vis.update("Transacted Price ($)");
        });
    }

    wrangleData(selectedTenure, selectedType, selectedLocation, dataType,dates) {
        const vis = this;
    
    
        console.log("Filtering and aggregating data based on dataType:", dataType);
    
        const dataFieldMap = {
            "Transacted Price ($)": "totalPrice",
            "Area (SQM)": "area",
            "Unit Price ($ PSM)": "averagePrice"
        };
    
        const dataField = dataFieldMap[dataType];
    
        // Filter the data based on selected dropdown values
        const filteredData = vis.data.filter(d => 
            (selectedTenure.length === 0 || selectedTenure.includes(d.tenureCategory)) &&
            (selectedType.length === 0 || selectedType.includes(d['Property Type'])) &&
            (selectedLocation.length === 0 || selectedLocation.includes(d["Planning Area"]))
        );
        let dateFilteredData = filteredData;
        console.log(dates)
        if (dates !== 'no go') {

            console.log('made it')
            dateFilteredData = filteredData.filter(d => 
                new Date(d.date) > new Date(dates.start) && new Date(d.date) < new Date(dates.end)
            );
    
            console.log("Start Date:", dates.start);
            console.log("End Date:", dates.end);
            console.log("Filtered Data:", dateFilteredData);
        }
        // Aggregate data by planning area based on selected dataType
        vis.districtData = d3.rollup(
            dateFilteredData,
            v => ({
                totalPrice: d3.sum(v, d => +d["Transacted Price ($)"]),
                area: d3.sum(v, d => +d["Area (SQM)"]),
                averagePrice: d3.mean(v, d => +d["Unit Price ($ PSM)"]),
                region: v[0]?.Region
            }),
            d => d["Planning Area"]
        );
    
        console.log("Filtered and aggregated districtData:", vis.districtData);
    
        vis.update(dataType);
    }
    
    
    update(dataType) {
        const vis = this;

        const metricMap = {
            "Transacted Price ($)": "totalPrice",
            "Area (SQM)": "area",
            "Unit Price ($ PSM)": "averagePrice"
        };

        const field = metricMap[dataType] || "totalPrice";
        const values = Array.from(vis.districtData.values()).map(d => d[field] || 1);
        const minValue = d3.min(values);
        const maxValue = d3.max(values);

        // Define the color scale
        vis.colorScale = d3.scaleLog()
            .domain([Math.max(1, minValue), maxValue])
            .range([d3.rgb("#68b0f7"), d3.rgb("#08306b")]);

        // Update the map paths without sharedState logic
        vis.svg.selectAll("path")
            .data(vis.singaporeGeoJSON)
            .join("path")
            .attr("d", vis.path)
            .attr("fill", d => {
                const district = d.properties.planning_area;
                const value = vis.districtData.get(district)?.[field] || 0;

                return value === 0 ? "#d7dce0" : vis.colorScale(value);
            })
            .attr("stroke", "#fff")
            .attr("stroke-width", 1)
            .on("mouseover", (event, d) => {
                const district = d.properties.planning_area;
                const data = vis.districtData.get(district) || { [field]: 0 };

                vis.tooltip.html(`
                    <strong>Planning Area:</strong> ${district}<br>
                    <strong>${dataType}:</strong> ${data[field]?.toLocaleString() || "N/A"}
                `)
                .style("visibility", "visible");

                d3.select(event.currentTarget).attr("fill", d3.rgb(255, 0, 0));
            })
            .on("mousemove", event => {
                const [x, y] = d3.pointer(event, vis.svg.node()); // Coordinates relative to the SVG
                vis.tooltip
                    .style("top", `${y + vis.MARGIN.TOP + 5}px`)
                    .style("left", `${x + vis.MARGIN.LEFT + 20}px`);
            })
            .on("mouseout", (event, d) => {
                const district = d.properties.planning_area;
                const value = vis.districtData.get(district)?.[field] || 0;

                d3.select(event.currentTarget)
                    .attr("fill", value === 0 ? "#d7dce0" : vis.colorScale(value));

                vis.tooltip.style("visibility", "hidden");
            })


        vis.svg.select(".map-title")
            .text(`${vis.title} - ${dataType}`);
    }
}
