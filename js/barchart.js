class BarChart {
    constructor(container, data) {
        this.container = d3.select(container);
        this.data = data;

        // Initialize selected properties
        this.selectedTenure = [];
        this.selectedType = [];
        this.selectedLocation = [];
        this.selectedMetric = "Transacted Price ($)";

        this.initChart();
        
        // Create tooltip with more robust positioning
        this.tooltip = d3.select('body')
            .append("div")
            .attr("class", "d3-tooltip")
            .style("position", "absolute")
            .style("visibility", "hidden")
            .style("background-color", "rgba(0,0,0,0.8)")
            .style("color", "#fff")
            .style("padding", "8px")
            .style("border-radius", "4px")
            .style("pointer-events", "none")
            .style("font-size", "12px");
    }

    initChart() {
        this.margin = { top: 20, right: 20, bottom: 50, left: 100 };
        this.width = 500 - this.margin.left - this.margin.right;
        this.height = 230 - this.margin.top - this.margin.bottom;

        this.svg = this.container
            .append("svg")
            .attr("width", this.width + this.margin.left + this.margin.right)
            .attr("height", this.height + this.margin.top + this.margin.bottom)
            .append("g")
            .attr("transform", `translate(${this.margin.left},${this.margin.top})`);

        this.xScale = d3.scaleBand().padding(0.1).range([0, this.width]);
        this.yScale = d3.scaleLinear().range([this.height, 0]);

        this.xAxisGroup = this.svg.append("g").attr("transform", `translate(0,${this.height})`);
        this.yAxisGroup = this.svg.append("g");

            // Add Chart Title
            this.container.select("svg")
            .append("text")
            .attr("class", "chart-title")
            .attr("text-anchor", "middle")
            .attr("x", (this.width + this.margin.left + this.margin.right) / 2)
            .attr("y", 15)
            .style("font-size", "16px")
            .style("font-weight", "bold")
            .text("Bar Chart Title");
        


        this.update();
    }

    wrangleData(selectedTenure = [], selectedType = [], selectedLocation = [], selectedMetric,dates) {
        this.selectedMetric = selectedMetric;
    
        const filteredData = this.data.filter(d =>
            (selectedTenure.length === 0 || selectedTenure.includes(d['tenureCategory'])) &&
            (selectedType.length === 0 || selectedType.includes(d['Property Type'])) &&
            (selectedLocation.length === 0 || selectedLocation.includes(d["Planning Area"]))
        );
        console.log(this.selectedMetric)
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


        const tenureData = d3.rollups(
            dateFilteredData,
            v => {
                const count = v.length;
                const avgValue = count > 0 ? d3.mean(v, d => +d[selectedMetric]) : 0;
                return { metricValue: avgValue, count: count };
            },
            d => d.tenureCategory
        );
        
        
    
        this.counts = Array.from(tenureData, ([category, values]) => ({
            category,
            metricValue: values.metricValue,
            count: values.count
        }));
    
        this.update();
    }
    

    update() {
        if (!this.counts || !Array.isArray(this.counts)) {
            console.log('No counts data available to update the chart');
            return;
        }
    
        // Set scales
        this.xScale.domain(this.counts.map(d => d.category));
        this.yScale.domain([0, d3.max(this.counts, d => d.metricValue)]);
    
        // Render X and Y axes
        this.xAxisGroup.call(d3.axisBottom(this.xScale));
    
        const formatComma = d3.format(",");
    
        // Conditionally format Y-axis labels
        if (this.selectedMetric === "Transacted Price ($)") {
            // For Transacted Price, display Y-axis values in millions
            this.yAxisGroup.call(d3.axisLeft(this.yScale).ticks(5).tickFormat(d => formatComma(d / 1000000) + "M"));
        } else {
            // For other metrics, display raw numbers without 'M'
            this.yAxisGroup.call(d3.axisLeft(this.yScale).ticks(5).tickFormat(d => formatComma(d)));
        }
    
        // Update bars
        const bars = this.svg.selectAll(".bar")
            .data(this.counts, d => d.category);
    
        bars.exit().remove();
    
        bars.enter()
            .append("rect")
            .attr("class", "bar")
            .merge(bars)
            .attr("x", d => this.xScale(d.category))
            .attr("width", this.xScale.bandwidth())
            .attr("fill", "orange")
            .on("mouseover", (event, d) => {
                this.tooltip
                    .style("visibility", "visible")
                    .html(`
                        <strong>Category:</strong> ${d.category}<br>
                        <strong>Value:</strong> ${d.metricValue.toLocaleString()}
                    `)
                    .style("top", `${event.pageY + 10}px`)
                    .style("left", `${event.pageX + 10}px`);
    
                d3.select(event.currentTarget)
                    .attr("opacity", 0.7);
            })
            .on("mousemove", (event, d) => {
                this.tooltip
                    .style("top", `${event.pageY + 10}px`)
                    .style("left", `${event.pageX + 10}px`);
            })
            .on("mouseout", (event, d) => {
                this.tooltip.style("visibility", "hidden");
                d3.select(event.currentTarget)
                    .attr("opacity", 1);
            })
            .transition()
            .duration(500)
            .attr("y", d => this.yScale(d.metricValue))
            .attr("height", d => this.height - this.yScale(d.metricValue));
    
        this.updateAxesTitles();
    }
    
    
    updateAxesTitles() {
        const vis = this;
    
        // Remove any existing titles to prevent duplication
        vis.svg.selectAll(".x-axis-title").remove();
        vis.svg.selectAll(".y-axis-title").remove();
    
        // X-axis Title
        vis.svg.append("text")
            .attr("class", "x-axis-title")
            .attr("x", vis.width / 2)
            .attr("y", vis.height + 40)
            .style("text-anchor", "middle")
            .style("font-weight", "bold")
            .text("Tenure remaining when sold");
    
        // Y-axis Title
        vis.svg.append("text")
            .attr("class", "y-axis-title")
            .attr("transform", "rotate(-90)")
            .attr("x", -vis.height / 2)
            .attr("y", -vis.margin.left + 40)
            .style("text-anchor", "middle")
            .style("font-weight", "bold")
            .text(`Average ${vis.selectedMetric}`);
    }
    
}