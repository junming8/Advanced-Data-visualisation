class StackedBarChart {
    constructor(parentElement, data, onUpdate) {
        this.parentElement = parentElement;
        this.data = data;
        this.selectedMetric = "Transacted Price ($)"; // Default metric
        this.onUpdate = onUpdate;  // Store onUpdate callback

        this.initVis();
        this.tooltip = d3.select(this.parentElement).append("div")
            .attr("class", "tooltip")
            .style("position", "absolute")
            .style("visibility", "hidden")
            .style("background-color", "rgba(0,0,0,0.7)")
            .style("color", "#fff")
            .style("padding", "10px")
            .style("border-radius", "5px")
            .style("font-size", "12px");
    }

    initVis() {
        const vis = this;

        vis.MARGIN_BAR = { LEFT: 100, RIGHT: 100, TOP: 50, BOTTOM: 50 };
        vis.WIDTH_BAR = 800 - vis.MARGIN_BAR.LEFT - vis.MARGIN_BAR.RIGHT;
        vis.HEIGHT_BAR = 300 - vis.MARGIN_BAR.TOP - vis.MARGIN_BAR.BOTTOM;

        vis.svgBar = d3.select(vis.parentElement).append("svg")
            .attr("width", vis.WIDTH_BAR + vis.MARGIN_BAR.LEFT + vis.MARGIN_BAR.RIGHT)
            .attr("height", vis.HEIGHT_BAR + vis.MARGIN_BAR.TOP + vis.MARGIN_BAR.BOTTOM)
            .append("g")
            .attr("transform", `translate(${vis.MARGIN_BAR.LEFT}, ${vis.MARGIN_BAR.TOP})`);

        // Process the data
        vis.barData = d3.rollup(
            vis.data,
            v => ({
                "Transacted Price ($)": d3.sum(v, d => +d["Transacted Price ($)"]),
                "Area (SQM)": d3.mean(v, d => +d["Area (SQM)"]),
                "Unit Price ($ PSM)": d3.mean(v, d => +d['Unit Price ($ PSM)'])
            }),
            d => d["Region"],
            d => d["Property Type"]
        );

        vis.updateChart()
    }

    updateChart(selectedRegion, selectedDateRange) {
        this.filterData(selectedRegion, selectedDateRange);  // Filter data based on region and date range
        this.updateStackData();   // Update stack data
        this.setupScales();       // Set up scales
        this.addAxes();           // Add axes
        this.addLegend();         // Add legend
        this.addBars();           // Add bars
    }

    filterData(selectedRegion, selectedDateRange) {
        const vis = this;

        let filteredData = vis.data;

        if (selectedDateRange) {
            filteredData = filteredData.filter(d => {
                const date = new Date(d.date);
                return date >= selectedDateRange.start && date <= selectedDateRange.end;
            });
        }

        if (selectedRegion) {
            filteredData = filteredData.filter(d => d["Region"] === selectedRegion);
        }

        vis.filteredData = filteredData;
        console.log("Filtered Data:", vis.filteredData);
    }

    addBars() {
        const vis = this;

        const stack = d3.stack()
            .keys(vis.colorScale.domain())
            .value((d, key) => {
                const propertyValue = d.values.find(item => item.type === key);
                const metricValue = propertyValue ? propertyValue[vis.selectedMetric] : 0;
                return metricValue; // No need to subtract for averages
            });

        const layers = stack(vis.stackData);

        vis.svgBar.selectAll("g.layer").remove(); // Clear previous layers

        const layer = vis.svgBar.selectAll("g.layer")
            .data(layers)
            .join("g")
            .attr("class", "layer")
            .attr("fill", d => vis.colorScale(d.key));

        layer.selectAll("rect")
            .data(d => d)
            .join("rect")
            .attr("x", d => vis.xScale(d.data.Region))
            .attr("y", d => vis.yScale(d[1]))
            .attr("height", d => vis.yScale(d[0]) - vis.yScale(d[1]))
            .attr("width", vis.xScale.bandwidth())
            .on("mouseover", function (event, d) {
                const isArea = vis.selectedMetric === "Area (SQM)";
                const isAverage = vis.selectedMetric === "Unit Price ($ PSM)";
                const metricValue = isArea ? d[1] - d[0] : d[1] - d[0];
                const formattedMetric = isArea 
                    ? metricValue.toLocaleString() + " m²" 
                    : isAverage 
                    ? metricValue.toLocaleString() 
                    : "$" + metricValue.toLocaleString();
            
                vis.tooltip.style("visibility", "visible")
                    .html(` 
                        <strong>${vis.selectedMetric}:</strong> ${formattedMetric}
                    `)
                    .style("top", (event.pageY - 10) + "px")
                    .style("left", (event.pageX + 10) + "px");
            
                d3.select(this).attr("opacity", 0.7);
            })
            .on("click", (event, d) => {
                if (this.onUpdate) {
                    this.onUpdate(d.data.Region); // Trigger updates in other visuals with selected region
                }
            })
            .on("mouseout", function () {
                vis.tooltip.style("visibility", "hidden");
                d3.select(this).attr("opacity", 1);
            });
    }

    updateMetric(selectedMetric) {
        const vis = this;

        // Update the selected metric
        vis.selectedMetric = selectedMetric;
        console.log('Selected Metric:', vis.selectedMetric);
        console.log('Bar Data:', vis.barData);

        // Recalculate the y-scale based on the new metric
        vis.updateYScale();

        // Update the y-axis
        vis.svgBar.select(".y-axis").remove(); // Clear the old axis
        vis.svgBar.append("g")
            .attr("class", "y-axis")
            .call(d3.axisLeft(vis.yScale).ticks(4).tickFormat(d => this.formatYAxis(d))); // Add custom tick formatting

        // Re-render the bars
        vis.addBars();
    }

    updateStackData() {
        const vis = this;

        // Convert the barData into a more suitable format for stacking
        vis.stackData = Array.from(vis.barData, ([Region, propertyData]) => {
            const properties = Array.from(propertyData, ([type, metrics]) => ({
                type,  // Property Type
                "Transacted Price ($)": metrics["Transacted Price ($)"],  // Access the "Transacted Price ($)"
                "Area (SQM)": metrics["Area (SQM)"],  // Access the "Area (SQM)"
                "Unit Price ($ PSM)": metrics["Unit Price ($ PSM)"]  // Access the "Unit Price ($ PSM)"]
            }));
            return { Region, values: properties };  // Return the region with the corresponding values
        });

        console.log("Updated stackData:", vis.stackData);  // Log stackData to verify it
    }

    setupScales() {
        const vis = this;

        vis.xScale = d3.scaleBand()
            .domain(vis.stackData.map(d => d.Region))
            .range([0, vis.WIDTH_BAR])
            .padding(0.1);

        vis.updateYScale();  // Update the y-scale with the initial data

        vis.colorScale = d3.scaleOrdinal()
            .domain(["Office", "Retail", "Shop House"]) 
            .range(["#1f77b4", "#ff7f0e", "#2ca02c"]); 
    }

    updateYScale() {
        const vis = this;

        const maxMetricValue = d3.max(vis.stackData, d => {
            const sum = d3.sum(d.values, v => v[vis.selectedMetric]);
            return sum;
        });

        vis.yScale = d3.scaleSqrt()
            .domain([0, maxMetricValue])
            .range([vis.HEIGHT_BAR, 0]);
    }

    addAxes() {
        const vis = this;

        // X-Axis
        vis.svgBar.append("g")
            .attr("transform", `translate(0,${vis.HEIGHT_BAR})`)
            .call(d3.axisBottom(vis.xScale));

        // Y-Axis
        vis.svgBar.append("g")
            .attr("class", "y-axis") // Add class for easier selection and updating
            .call(d3.axisLeft(vis.yScale).ticks(4).tickFormat(d => this.formatYAxis(d)));  // Add custom tick formatting
    }

    formatYAxis(d) {
        const formatComma = d3.format(","); // For adding commas
        const millionValue = d / 1e6;  // Convert to millions
        return `${formatComma(millionValue)}M`; // Return value with 'M' suffix
    }

    addLegend() {
        const vis = this;
    
        // Offset to position the legend outside the chart
        const legendXOffset = vis.WIDTH_BAR; // Move it outside the chart to the right
        const legendYOffset = 10; // Adjust the vertical offset
    
        const legend = vis.svgBar.append("g")
            .attr("class", "legend-group")
            .attr("transform", `translate(${legendXOffset}, ${legendYOffset})`);
    
        legend.selectAll(".legend")
            .data(vis.colorScale.domain())
            .join("g")
            .attr("class", "legend")
            .attr("transform", (d, i) => `translate(0, ${i * 20})`) // Spacing between legend items
            .each(function (d, i) {
                const legendItem = d3.select(this);
    
                legendItem.append("rect")
                    .attr("x", 0)
                    .attr("width", 9)
                    .attr("height", 9)
                    .style("fill", vis.colorScale(d));
    
                legendItem.append("text")
                    .attr("x", 12) // Position text next to the rectangle
                    .attr("y", 4)
                    .attr("dy", ".35em")
                    .style("text-anchor", "start")
                    .text(d);
            });
    }
}
