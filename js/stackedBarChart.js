class StackedBarChart {
    constructor(parentElement, data, onUpdate) {
        this.parentElement = parentElement;
        this.data = data;
        this.selectedMetric = "Transacted Price ($)"; // Default metric
        this.onUpdate = onUpdate;

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

        vis.MARGIN_BAR = { LEFT: 95, RIGHT: 100, TOP: 50, BOTTOM: 50 };
        vis.WIDTH_BAR = 550 - vis.MARGIN_BAR.LEFT - vis.MARGIN_BAR.RIGHT;
        vis.HEIGHT_BAR = 300 - vis.MARGIN_BAR.TOP - vis.MARGIN_BAR.BOTTOM;

        vis.svgBar = d3.select(vis.parentElement).append("svg")
            .attr("width", vis.WIDTH_BAR + vis.MARGIN_BAR.LEFT + vis.MARGIN_BAR.RIGHT)
            .attr("height", vis.HEIGHT_BAR + vis.MARGIN_BAR.TOP + vis.MARGIN_BAR.BOTTOM)
            .append("g")
            .attr("transform", `translate(${vis.MARGIN_BAR.LEFT}, ${vis.MARGIN_BAR.TOP})`);

        // Add a placeholder for the dynamic chart title
        vis.chartTitle = vis.svgBar.append("text")
            .attr("class", "chart-title")
            .attr("x", (vis.WIDTH_BAR + vis.MARGIN_BAR.LEFT + vis.MARGIN_BAR.RIGHT) / 2 - vis.MARGIN_BAR.LEFT)
            .attr("y", -20)
            .style("text-anchor", "middle")
            .style("font-size", "16px")
            .style("font-weight", "bold");

        // Initialize the title with the default metric
        vis.updateChartTitle();

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

        this.tooltip = d3.select(this.parentElement).append("div")
            .attr("class", "tooltip")
            .style("position", "absolute")
            .style("visibility", "hidden")
            .style("background-color", "rgba(0,0,0,0.7)")
            .style("color", "#fff")
            .style("padding", "10px")
            .style("border-radius", "5px")
            .style("font-size", "12px");


        vis.updateChart();
    }

    wrangleData(selectedTenure, selectedType, selectedLocation, selectedMetric, dates) {
        const vis = this;
        // Filtering all the data based on the dropdowns and brush
        const filteredData = vis.data.filter(d => 
            (selectedTenure.length === 0 || selectedTenure.includes(d.tenureCategory)) &&
            (selectedType.length === 0 || selectedType.includes(d['Property Type'])) &&
            (selectedLocation.length === 0 || selectedLocation.includes(d["Planning Area"]))
        );
        vis.selectedMetric = selectedMetric;

        let dateFilteredData = filteredData;
        if (dates !== 'no go') {
            dateFilteredData = filteredData.filter(d => 
                new Date(d.date) > new Date(dates.start) && new Date(d.date) < new Date(dates.end)
            );
        }

        vis.barData = d3.rollup(
            dateFilteredData,
            v => ({
                "Transacted Price ($)": d3.sum(v, d => +d["Transacted Price ($)"]),
                "Area (SQM)": d3.mean(v, d => +d["Area (SQM)"]),
                "Unit Price ($ PSM)": d3.mean(v, d => +d['Unit Price ($ PSM)'])
            }),
            d => d["Region"],
            d => d["Property Type"]
        );
        this.updateChart();
    }

    updateChart() {
        this.updateStackData();
        this.setupScales();
        this.addAxes();
        this.addLegend();
        this.addBars();
    }

    updateChartTitle() {
        const vis = this;

        vis.chartTitle.text(`Stacked Bar Chart of ${vis.selectedMetric} by Type`);
    }

    addBars() {
        const vis = this;
        
        const stack = d3.stack()
            .keys(vis.colorScale.domain())
            .value((d, key) => {
                const propertyValue = d.values.find(item => item.type === key);
                const metricValue = propertyValue ? propertyValue[vis.selectedMetric] : 0;
                return metricValue;
            });

        const layers = stack(vis.stackData);

        vis.svgBar.selectAll("g.layer").remove();

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
            .on("mouseover", (event, d) => {
                const isArea = vis.selectedMetric === "Area (SQM)";
                const isAverage = vis.selectedMetric === "Unit Price ($ PSM)";
                const metricValue = d[1] - d[0];
                const formattedMetric = isArea
                    ? metricValue.toLocaleString() + " m²"
                    : isAverage
                    ? metricValue.toLocaleString()
                    : "$" + metricValue.toLocaleString();
        
                vis.tooltip.html(`
                    <strong>${vis.selectedMetric}:</strong> ${formattedMetric}
                `).style("visibility", "visible");
        
                d3.select(event.currentTarget).attr("opacity", 0.7);
            })
            .on("mousemove", event => {
                const [x, y] = d3.pointer(event, vis.svgBar.node());
                vis.tooltip
                    .style("top", `${y + vis.MARGIN_BAR.TOP + 5}px`)
                    .style("left", `${x + vis.MARGIN_BAR.LEFT + 20}px`);
            })
            .on("mouseout", event => {
                vis.tooltip.style("visibility", "hidden");
                d3.select(event.currentTarget).attr("opacity", 1);
            });
        
    }

    updateMetric(selectedMetric) {
        const vis = this;
        vis.selectedMetric = selectedMetric;

        vis.updateYScale();
        vis.updateChartTitle();

        vis.addBars();
    }

    updateStackData() {
        const vis = this;
        vis.stackData = Array.from(vis.barData, ([Region, propertyData]) => {
            const properties = Array.from(propertyData, ([type, metrics]) => ({
                type,
                "Transacted Price ($)": metrics["Transacted Price ($)"],
                "Area (SQM)": metrics["Area (SQM)"],
                "Unit Price ($ PSM)": metrics["Unit Price ($ PSM)"]
            }));
            return { Region, values: properties };
        });
    }

    setupScales() {
        const vis = this;
        vis.xScale = d3.scaleBand()
            .domain(vis.stackData.map(d => d.Region))
            .range([0, vis.WIDTH_BAR])
            .padding(0.1);

        vis.updateYScale();

        vis.colorScale = d3.scaleOrdinal()
            .domain(["Office", "Retail", "Shop House"])
            .range(["#1f77b4", "#ff7f0e", "#2ca02c"]);
    }

    updateYScale() {
        const vis = this;
        const maxMetricValue = d3.max(vis.stackData, d => {
            return d3.sum(d.values, v => v[vis.selectedMetric]);
        });

        vis.yScale = d3.scaleSqrt()
            .domain([0, maxMetricValue])
            .range([vis.HEIGHT_BAR, 0]);
    }

    addAxes() {
        const vis = this;
        vis.svgBar.select(".y-axis").remove();
        vis.svgBar.select(".x-axis").remove();

        vis.chartTitle.text(`Stacked Bar Chart of ${vis.selectedMetric} by Type`);

        vis.svgBar.append("g")
            .attr("class", "x-axis")
            .attr("transform", `translate(0,${vis.HEIGHT_BAR})`)
            .call(d3.axisBottom(vis.xScale));

        vis.svgBar.append("g")
            .attr("class", "y-axis")
            .call(d3.axisLeft(vis.yScale).ticks(4).tickFormat(d => this.formatYAxis(d)));

        vis.svgBar.selectAll(".axis-title").remove();

        vis.svgBar.append("text")
            .attr("class", "axis-title")
            .attr("transform", "rotate(-90)")
            .attr("x", -vis.HEIGHT_BAR / 2)
            .attr("y", -vis.MARGIN_BAR.LEFT + 20)
            .style("text-anchor", "middle")
            .text(vis.selectedMetric);

        vis.svgBar.append("text")
            .attr("class", "axis-title")
            .attr("x", vis.WIDTH_BAR / 2)
            .attr("y", vis.HEIGHT_BAR + 40)
            .style("text-anchor", "middle")
            .text("Region");
    }

    formatYAxis(d) {
        const formatComma = d3.format(",");
        if (this.selectedMetric === "Transacted Price ($)") {
            return `${formatComma(d / 1e6)}M`;
        } else {
            return formatComma(d);
        }
    }


    addLegend() {
        const vis = this;
    
        // Offset to position the legend outside the chart
        const legendXOffset = vis.WIDTH_BAR;
        const legendYOffset = 10; 
    
        const legend = vis.svgBar.append("g")
            .attr("class", "legend-group")
            .attr("transform", `translate(${legendXOffset}, ${legendYOffset})`);
    
        legend.selectAll(".legend")
            .data(vis.colorScale.domain())
            .join("g")
            .attr("class", "legend")
            .attr("transform", (d, i) => `translate(0, ${i * 20})`)
            .each(function (d, i) {
                const legendItem = d3.select(this);
    
                legendItem.append("rect")
                    .attr("x", 0)
                    .attr("width", 9)
                    .attr("height", 9)
                    .style("fill", vis.colorScale(d));
    
                legendItem.append("text")
                    .attr("x", 12)
                    .attr("y", 4)
                    .attr("dy", ".35em")
                    .style("text-anchor", "start")
                    .text(d);
            });
    }
}
