class Timeline {
    constructor(_parentElement, data, sharedState) {
        this.parentElement = _parentElement;
        this.data = data;
        this.sharedState = sharedState;

        this.initVis();
    }

    initVis() {
        const vis = this;
    
        vis.MARGIN = { LEFT: 65, RIGHT: 10, TOP: 60, BOTTOM: 60 };
        vis.WIDTH = 500 - vis.MARGIN.LEFT - vis.MARGIN.RIGHT;
        vis.HEIGHT = 200 - vis.MARGIN.TOP - vis.MARGIN.BOTTOM;
    
        vis.svg = d3.select(vis.parentElement).append("svg")
            .attr("width", vis.WIDTH + vis.MARGIN.LEFT + vis.MARGIN.RIGHT)
            .attr("height", vis.HEIGHT + vis.MARGIN.TOP + vis.MARGIN.BOTTOM);
    
        vis.g = vis.svg.append("g")
            .attr("transform", `translate(${vis.MARGIN.LEFT}, ${vis.MARGIN.TOP})`);
    
        // Add Chart Title
        vis.svg.append("text")
            .attr("class", "chart-title")
            .attr("text-anchor", "middle")
            .attr("x", (vis.WIDTH + vis.MARGIN.LEFT + vis.MARGIN.RIGHT) / 2)
            .attr("y", 20)
            .style("font-weight", "bold")
            .style("font-size", "16px")
            .text("Count of property sold over time");
    
        vis.x = d3.scaleTime().range([0, vis.WIDTH]);
        vis.y = d3.scaleLinear().range([vis.HEIGHT, 0]);
    
        // Append X Axis Group
        vis.xAxisCall = d3.axisBottom().ticks(5);
        vis.xAxis = vis.g.append("g")
            .attr("class", "x axis")
            .attr("transform", `translate(0, ${vis.HEIGHT})`);
    
        // Append Y Axis Group
        vis.yAxisCall = d3.axisLeft(vis.y).ticks(5);
        vis.yAxis = vis.g.append("g")
            .attr("class", "y axis");
    
        // X Axis Title (Appended Only Once)
        vis.xAxisTitle = vis.g.append("text")
            .attr("class", "x axis-title")
            .attr("text-anchor", "middle")
            .attr("x", vis.WIDTH / 2)
            .attr("y", vis.HEIGHT + 50)
            .text("Time");
    
        // Y Axis Title (Appended Only Once)
        vis.yAxisTitle = vis.g.append("text")
            .attr("class", "y axis-title")
            .attr("text-anchor", "middle")
            .attr("x", -vis.HEIGHT / 2)
            .attr("y", -60)
            .attr("transform", "rotate(-90)")
            .text("Count");
    
        // Brush and Area Path Initialization
        vis.areaPath = vis.g.append("path").attr("fill", "#ccc");
    
        vis.brush = d3.brushX()
            .handleSize(10)
            .extent([[0, 0], [vis.WIDTH, vis.HEIGHT]])
            .on("brush end", window.brushed);
    
        vis.brushComponent = vis.g.append("g")
            .attr("class", "brush")
            .call(vis.brush);
    
        vis.dataFiltered = [];
        vis.currentBrushSelection = null;
        vis.wrangleData();
    }
    
    

    wrangleData(selectedTenure = [], selectedType = [], selectedLocation = [], metrics = []) {
        const vis = this;

        // Step 1: Filter data based on the selected filters
        const filteredData = vis.data.filter(d =>
            (selectedTenure.length === 0 || selectedTenure.includes(d['tenureCategory'])) &&
            (selectedType.length === 0 || selectedType.includes(d['Property Type'])) &&
            (selectedLocation.length === 0 || selectedLocation.includes(d["Planning Area"]))
        );

        // Step 2: Group filtered data by date
        const groupedData = d3.group(filteredData, d => d.date);

        // Step 3: Aggregate the grouped data
        vis.dataFiltered = Array.from(groupedData, ([date, values]) => {
            const count = values.length;
            return {
                date: new Date(date),
                count: count
            };
        });

        // Step 4: Sort the aggregated data by date
        vis.dataFiltered.sort((a, b) => a.date - b.date);

        // Step 5: Update the visualization
        vis.updateVis();
    }

    updateVis() {
        const vis = this;
    
        // Clean everything inside 'g' except the brush
        vis.g.selectAll("*:not(.brush)").remove();
    
        if (vis.dataFiltered.length > 0) {
            // Define Scales
            vis.x.domain(d3.extent(vis.dataFiltered, d => d.date));
            vis.y.domain([1, d3.max(vis.dataFiltered, d => d.count)]);
    
            // X Axis
            vis.xAxisCall.scale(vis.x);
            vis.xAxis = vis.g.append("g")
                .attr("class", "x axis")
                .attr("transform", `translate(0, ${vis.HEIGHT})`)
                .call(vis.xAxisCall);
    
            // Y Axis
            vis.yAxisCall = d3.axisLeft(vis.y).ticks(5).tickFormat(d => d);
            vis.yAxis = vis.g.append("g")
                .attr("class", "y axis")
                .call(vis.yAxisCall);
    
            // Area path generator
            const area = d3.area()
                .x(d => vis.x(d.date))
                .y0(vis.HEIGHT)
                .y1(d => vis.y(d.count));
    
            vis.areaPath = vis.g.append("path")
                .attr("fill", "#ccc")
                .attr("opacity", 0.7)
                .datum(vis.dataFiltered)
                .attr("d", area);
    
            // Brush group
            let brushGroup = vis.g.select(".brush");
            if (brushGroup.empty()) {
                brushGroup = vis.g.append('g')
                    .attr("class", "brush")
                    .call(vis.brush);
            } else {
                brushGroup.call(vis.brush);
            }
    
            // X Axis Title
            let xAxisTitle = vis.svg.select(".x-axis-title");
            if (xAxisTitle.empty()) {
                xAxisTitle = vis.svg.append("text")
                    .attr("class", "x-axis-title")
                    .attr("text-anchor", "middle")
                    .attr("x", vis.WIDTH / 2 + vis.MARGIN.LEFT)
                    .attr("y", vis.HEIGHT + vis.MARGIN.TOP + 40);
            }
            xAxisTitle.text("Time"); // Set or update the X-axis title
    
            // Y Axis Title
            let yAxisTitle = vis.svg.select(".y-axis-title");
            if (yAxisTitle.empty()) {
                yAxisTitle = vis.svg.append("text")
                    .attr("class", "y-axis-title")
                    .attr("text-anchor", "middle")
                    .attr("transform", "rotate(-90)")
                    .attr("x", -(vis.HEIGHT / 2) - vis.MARGIN.TOP)
                    .attr("y", vis.MARGIN.LEFT / 2 - 20);
            }
            yAxisTitle.text("Count");
        } else {
            console.error("No valid data to visualize.");
        }
    }
    

    slide(direction) {
        const vis = this;

        if (!vis.currentBrushSelection) {
            console.error("No brush selection to slide.");
            return;
        }

        const [start, end] = vis.currentBrushSelection;
        const interval = (end - start) * 0.1; // Adjust the interval to slide 10% of the range

        let newStart, newEnd;
        if (direction === "left") {
            newStart = Math.max(0, start - interval);
            newEnd = Math.max(interval, end - interval);
        } else if (direction === "right") {
            newStart = Math.min(vis.WIDTH - interval, start + interval);
            newEnd = Math.min(vis.WIDTH, end + interval);
        } else {
            console.error("Invalid direction for slide: must be 'left' or 'right'.");
            return;
        }

        vis.currentBrushSelection = [newStart, newEnd];
        vis.brushComponent.call(vis.brush.move, vis.currentBrushSelection);
    }
}
