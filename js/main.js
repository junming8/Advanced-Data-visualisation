let map;
let stackedBarChart;
let areaChart;
let barChart;
let timeline;
let metricSelect;
let uniqueTenure, uniqueType, uniqueLocation, uniqueMetrics, data;

// Load the data and initialize the visualizations
d3.csv("cleaned_data.csv").then(data => {
    const parseDate = d3.timeParse("%b-%y");
    const formatDate = d3.timeFormat("%Y-%m-%d");

    const bins = [
        { range: [0, 50], label: "0-50 years" },
        { range: [51, 100], label: "51-100 years" },
        { range: [101, Infinity], label: "> 100 years" }
    ];

    // Process data
    data.forEach(d => {
        d.Latitude = Number(d.Latitude);
        d.Longitude = Number(d.Longitude);
        d["Transacted Price ($)"] = +d["Transacted Price ($)"].replace(/[^0-9.-]+/g, "");
        d["Area (SQM)"] = +d["Area (SQM)"].replace(/[^0-9.-]+/g, "");
        d["Unit Price ($ PSM)"] = +d["Unit Price ($ PSM)"].replace(/[^0-9.-]+/g, "");
        d["Planning Area"] = String(d["Planning Area"]);
        d["Property Type"] = String(d["Property Type"]);
        d.Region = String(d.Region);
        d["Tenure Lease Period"] = d["Tenure Lease Period"];

        const parsedDate = parseDate(d["Sale Date"]);
        d.date = parsedDate ? formatDate(parsedDate) : null;

        const tenure = d["Tenure Remaining"];
        if (tenure === "Freehold") {
            d.tenureCategory = "Freehold";
        } else {
            const numericTenure = +tenure;
            if (!isNaN(numericTenure)) {
                const bin = bins.find(b => numericTenure >= b.range[0] && numericTenure <= b.range[1]);
                d.tenureCategory = bin ? bin.label : "Unknown";
            } else {
                d.tenureCategory = "Unknown";
            }
        }
    });

    const validDates = data
        .map(d => d.date)
        .filter(date => date !== null)
        .map(date => new Date(date));

    // Find smallest and largest dates
    const smallestDate = d3.min(validDates);
    const largestDate = d3.max(validDates);

    function onUpdate(start_date="",stop_date="") {

        console.log("checker",start_date)
        const tenureDropdown = document.querySelector("#drop_down_tenure");
        const typeDropdown = document.querySelector("#drop_down_type");
        const locationDropdown = document.querySelector("#drop_down_location");
        const metricSelect = document.querySelector("#metricSelect");
    
        const selectedMetric = metricSelect ? metricSelect.value : null;
    
        const options_tenure = tenureDropdown.querySelectorAll('.multi-select-header-option');
        const selectedTenure = Array.from(options_tenure).map(opt => opt.getAttribute('data-value'));
        console.log("Selected Tenure:", selectedTenure);
    
        const options_type = typeDropdown.querySelectorAll('.multi-select-header-option');
        const selectedType = Array.from(options_type).map(opt => opt.getAttribute('data-value'));
        console.log("Selected Type:", selectedType);
    
        const options_location = locationDropdown.querySelectorAll('.multi-select-header-option');
        const selectedLocation = Array.from(options_location).map(opt => opt.getAttribute('data-value'));
        console.log("Selected Location:", selectedLocation);
        let brushValues;
        
        if (start_date && stop_date){
         brushValues = { start: start_date, end: stop_date };
         console.log("brush values:",brushValues)

        }else{
             brushValues = {start: formatDate(smallestDate),end: formatDate(largestDate)}
        }
        console.log("brush values:",brushValues)
    
        console.log("Selected Metric:", selectedMetric);
    
        // Pass selected values and brush values to the visualization update functions
        map.wrangleData(selectedTenure, selectedType, selectedLocation, selectedMetric, brushValues);
        barChart.wrangleData(selectedTenure, selectedType, selectedLocation, selectedMetric, brushValues);
        timeline.wrangleData(selectedTenure, selectedType, selectedLocation, selectedMetric, brushValues);
        stackedBarChart.wrangleData(selectedTenure, selectedType, selectedLocation, selectedMetric, brushValues);
    }
    
    

    // Extract unique values for dropdowns
    uniqueTenure = Array.from(new Set(data.map(d => d.tenureCategory)));
    uniqueType = Array.from(new Set(data.map(d => d['Property Type'])));
    uniqueLocation = Array.from(new Set(data.map(d => d["Planning Area"])));
    uniqueMetrics = ["Transacted Price ($)", "Area (SQM)", "Unit Price ($ PSM)"];


    // Initialize MultiSelect components
    new MultiSelect("#drop_down_tenure", {
        placeholder: "Select Tenure",
        data: uniqueTenure.map(value => ({ value, text: value })),
        selectedValues: uniqueTenure,
        onChange: () => onUpdate()
    });

    new MultiSelect("#drop_down_type", {
        placeholder: "Select Property Type",
        data: uniqueType.map(value => ({ value, text: value })),
        selectedValues: uniqueType,
        onChange: () => onUpdate() 
    });

    new MultiSelect("#drop_down_location", {
        placeholder: "Select Location",
        data: uniqueLocation.map(value => ({ value, text: value })),
        selectedValues: uniqueLocation,
        onChange: () => onUpdate() 
    });


    // Initialize single-select dropdown for metrics
    metricSelect = document.getElementById("metricSelect");
    uniqueMetrics.forEach(metric => {
        const option = document.createElement("option");
        option.value = metric;
        option.textContent = metric;
        metricSelect.appendChild(option);
    });

    metricSelect.addEventListener("change", onUpdate);

    // Define the brushed callback in window scope
    window.brushed = function (event) {
        const selection = event.selection || timeline.x.range();
        const newValues = selection.map(timeline.x.invert);
    
        console.log("Cross-filter applied from:", newValues[0], "to:", newValues[1]);
    
        // Update date range specifically
        onUpdate(formatDate(newValues[0]), formatDate(newValues[1]));
    };
    

    function changeDates(values) {
        console.log(values)
        console.log(formatDate(values[0]))
        onUpdate(formatDate(values[0]),formatDate(values[1]))

    }

    // Load and initialize visualizations
    d3.json("district_and_planning_area.geojson").then(singaporeGeoJSON => {
        const singaporeGeoJSON_ = singaporeGeoJSON.features;
        map = new MapVisual("#mapContainer", data, "Singapore Map", singaporeGeoJSON_);
        stackedBarChart = new StackedBarChart("#stackedBarChart", data);
        timeline = new Timeline("#timeline", data);
        barChart = new BarChart("#barChart", data);

        // Trigger initial update
        onUpdate();
    });
});
