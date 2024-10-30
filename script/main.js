/**
 * Here we have some amazing libraries:
 * https://www.ag-grid.com/
 * https://github.com/pgrabovets/json-view?tab=readme-ov-file
 * https://github.com/center-key/pretty-print-json
 * https://github.com/tandrewnichols/extract-json-from-string
 **/

// #region Initial Variables
const SELECTED_TOGGLE_BUTTON_KEY = 'SELECTED_TOGGLE_BUTTON_KEY';
const PREVIEW_JSON_OPTION = 'PREVIEW_JSON_OPTION';
const BEAUTIFY_JSON_OPTION = 'BEAUTIFY_JSON_OPTION';
const TOOGLE_BUTTON_OPTIONS = {
    PREVIEW_JSON_OPTION: {
        buttonId: 'PreviewJsonButtonId',
        containerId: 'PreviewJsonCodeId'
    },
    BEAUTIFY_JSON_OPTION: {
        buttonId: 'BeautifyJsonButtonId',
        containerId: 'BeautifyJsonCodeId'
    }
};

const JSON_STRING_KEY = 'JSON_STRING_KEY';

sessionStorage.setItem(SELECTED_TOGGLE_BUTTON_KEY, PREVIEW_JSON_OPTION);
sessionStorage.setItem(JSON_STRING_KEY, '{}');

let myAgGrid = null;
// #endregion


// #region ProcessLogFile
function capitalize(text) {
    return text.charAt(0).toUpperCase() + text.toLowerCase().slice(1);
}

function isEmptyObject(obj) {
    for(var prop in obj) {
        if(obj.hasOwnProperty(prop))
            return false;
    }
    return true;
}

// i.e. 2024-10-18T16:14:20.915117-07:00
function getMicroseconds(dateTimeString) {
    const startIndex = dateTimeString.indexOf('.') + 1;
    const endIndex = startIndex + 6;
    const microseconds = parseInt(dateTimeString.substring(startIndex, endIndex));
    
    const timeInMillis = Date.parse(dateTimeString);
    const milliseconds = timeInMillis % 1000;

    return (timeInMillis - milliseconds) * 1000 + microseconds;
}

function processLogLine(line) {
    //console.log('>>>>');
    //console.log(line);

    // Extract DateTime (this should never fail)
    const startDateTimeIndex = line.indexOf('[');
    const endDateTimeIndex = line.indexOf(']');
    const dateTimeString = line.substring(startDateTimeIndex+1, endDateTimeIndex);

    const timeInMillis = Date.parse(dateTimeString);
    const dateTime = new Date(timeInMillis);


    // Extract Type
    const startTypeIndex = line.indexOf('.', endDateTimeIndex) + 1;
    const endTypeIndex = line.indexOf(':', startTypeIndex);
    const logType = line.substring(startTypeIndex, endTypeIndex);


    // Extract JsonObjects
    const jsonObjects = extractJson(line.substring(endTypeIndex + 1)) ?? [];
    let appJsonObject = { customer_id: 0 };
    let finalJsonObjects = [];
    jsonObjects.forEach(jsonObject => {
        if (Array.isArray(jsonObject) && jsonObject.length > 0) {
            finalJsonObjects.push(jsonObject);
        }

        if (!isEmptyObject(jsonObject)) {
            if (jsonObject['application']) {
                appJsonObject = jsonObject;

                for (let i=0; i<=5; i++) {
                    const keyObj = i.toString();
                    if (appJsonObject[keyObj]) {
                        finalJsonObjects.push(appJsonObject[keyObj]);
                    }
                }
            } else {
                finalJsonObjects.push(jsonObject);
            }
        }
    });

    const jsonText = (finalJsonObjects.length === 1)
        ? ((finalJsonObjects[0]['1']) ? JSON.stringify(finalJsonObjects[0]['1']) : JSON.stringify(finalJsonObjects[0]))
        : ((finalJsonObjects.length === 0) ? '{}' : JSON.stringify(finalJsonObjects));


    // Extract TextMessage
    let startJsonIndex = line.indexOf('{', endTypeIndex);
    if (startJsonIndex === -1) {
        startJsonIndex = line.indexOf('[', endTypeIndex);
    }
    
    let textMessage = (startJsonIndex > 0)
        ? line.substring(endTypeIndex + 1, startJsonIndex).trim()
        : '';

    return {
        microseconds: getMicroseconds(dateTimeString),
        date_time: dateTime.toUTCString(),
        type: capitalize(logType),
        customer_id: appJsonObject['customer_id'],
        text: textMessage,
        json: jsonText
    };
}

function processLogFile(logFile) {
    if (!logFile) {
        return;
    }

    const dateTimeRegex = /\[\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{6}[-+]\d{2}:\d{2}\]/g;
    let matchIndices = Array.from(logFile.matchAll(dateTimeRegex)).map(x => x.index);

    if (matchIndices.length === 0) {
        console.error('We dont have a single log starting with the DateTime format [xxxx-xx-xxTxx:xx:xx.xxxxxx-xx:xx].');
        return;
    }
    
    let rows = [];
    for (let i=0; i<matchIndices.length; i++) {
        const line = (i === matchIndices.length - 1)
            ? logFile.substring(matchIndices[i])
            : logFile.substring(matchIndices[i], matchIndices[i+1]);

        rows.push(processLogLine(line));
    }

    return rows;
}
// #endregion


// #region UIHelpers
function setDisplay(elementId, display) {
    const element = document.getElementById(elementId);
    if (element) {
        element.style.display = display;
    }
}

function displayWalkingCat() {
    setDisplay('WalkingCatId', 'block');
}

function hideWalkingCat() {
    setDisplay('WalkingCatId', 'none');
}

function displayBodyContainer() {
    setDisplay('BodyContainerId', 'flex');
}

function hideBodyContainer() {
    setDisplay('BodyContainerId', 'none');
}

function onLoadFileInput(result) {
    hideWalkingCat();
    displayBodyContainer();

    const rowData = processLogFile(result);
    updateDataGrid(rowData);
}

function toggleButton(toggleButtonOption) {
    sessionStorage.setItem(SELECTED_TOGGLE_BUTTON_KEY, toggleButtonOption);

    const firstButton = document.getElementById('PreviewJsonButtonId');
    firstButton.className = '';

    const secondButton = document.getElementById('BeautifyJsonButtonId');
    secondButton.className = '';

    if (toggleButtonOption === PREVIEW_JSON_OPTION) {
        firstButton.classList.add('left-toggle-button-selected');
        secondButton.classList.add('right-toggle-button');

        setDisplay('PreviewJsonCodeId', 'block');
        setDisplay('BeautifyJsonCodeId', 'none');
    } else {
        firstButton.classList.add('left-toggle-button');
        secondButton.classList.add('right-toggle-button-selected');

        setDisplay('PreviewJsonCodeId', 'none');
        setDisplay('BeautifyJsonCodeId', 'block');
    }
}
// #endregion


// #region JsonHelpers
function previewJson() {
    const element = document.getElementById('PreviewJsonCodeId');
    element.innerHTML = '';

    const tree = jsonview.create(sessionStorage.getItem(JSON_STRING_KEY));
    jsonview.render(tree, element);
    jsonview.expand(tree);
}

function beautifyJson() {
    const element = document.getElementById('JsonCodeId');
    var jsonObject = JSON.parse(sessionStorage.getItem(JSON_STRING_KEY));
    element.innerHTML = prettyPrintJson.toHtml(jsonObject);
}

function viewJson() {
    if (sessionStorage.getItem(SELECTED_TOGGLE_BUTTON_KEY) === PREVIEW_JSON_OPTION) {
        previewJson();
    } else {
        beautifyJson();
    }
}
// #endregion


// #region Components
function showSnackBack() {
    // Get the snackbar DIV
    var x = document.getElementById('snackbar');

    // Add the 'show' class to DIV
    x.className = 'show';

    // After 3 seconds, remove the show class from DIV
    setTimeout(function () { x.className = x.className.replace('show', ''); }, 3000);
}

class MicrosecondsCell {
    init(params) {
        this.eGui = document.createElement('div');
        this.eGui.style = 'display: inline-flex; height: 30px; line-height: normal; text-align: left;';

        this.eGui.innerHTML = `<button class="copy-button-selector copy-button">Copy</button>
                               <span style="padding-top: 4px; margin-left: 8px;">${params.value}</span>`;

        this.btnLn = this.eGui.querySelector('.copy-button-selector');
        this.btnLn.onclick = ()=> { 
            navigator.clipboard.writeText(params.value);
            showSnackBack();
        };
    }

    getGui() {
        return this.eGui;
    }

    refresh() {
        return false;
    }

    destroy() {
    }
}

class TypeCell {
    init(params) {
        const COLORS = {
            DEFAULT: { background: '#e7eaef', border: '#d3d6d8', font: '#41464b' },
            DEBUG: { background: '#e0cffc', border: '#aa8bdf', font: '#4a3967' },
            INFO: { background: '#c5f3de', border: '#93c6af', font: '#3d6947' },
            NOTICE: { background: '#cfe2ff', border: '#b6d4fe', font: '#084298' },
            WARNING: { background: '#fff3cd', border: '#ffecb5', font: '#664d03' },
            ERROR: { background: '#f8d7da', border: '#f5c2c7', font: '#842029' },
        };

        const key = (params.value) ? params.value.toString().toUpperCase() : 'DEFAULT';
        const color = COLORS[key];
        const style = `padding: 5px 15px; border-radius: 20px; background: ${color.background}; border: 1px solid ${color.border}; color: ${color.font};`;

        this.eGui = document.createElement('div');
        this.eGui.style = 'text-align: center;';
        this.eGui.innerHTML = `<span style="${style}">${params.value}</button>`;
    }

    getGui() {
        return this.eGui;
    }

    refresh() {
        return false;
    }

    destroy() {
        
    }
}

class TextCell {
    init(params) {
        this.eGui = document.createElement('div');
        this.eGui.style = 'display: inline-flex; height: 30px; line-height: normal; text-align: left;';

        this.eGui.innerHTML = `<button class="copy-button-selector copy-button">Copy</button>
                               <div style="margin-left: 8px; width: 146px; max-width: 146px; border-radius: 2px; background: #fff6e0;">
                                   <p style="overflow: auto; padding: 4px; font-size: 12px;">${params.value}</p>
                               </div>`;

        this.btnLn = this.eGui.querySelector('.copy-button-selector');
        this.btnLn.onclick = ()=> { 
            navigator.clipboard.writeText(params.value);
            showSnackBack();
        };
    }

    getGui() {
        return this.eGui;
    }

    refresh() {
        return false;
    }

    destroy() {
    }
}

class JsonCell {
    init(params) {
        this.eGui = document.createElement('div');
        this.eGui.style = 'display: inline-flex; height: 30px; line-height: normal; text-align: left;';

        this.eGui.innerHTML = `<button class="copy-button-selector copy-button">Copy</button>
                               <button style="margin-left: 8px;" class="view-button-selector view-button">View</button>
                               <div style="margin-left: 8px; width: 260px; max-width: 260px; border-radius: 2px; background: #fff6e0;">
                                   <p style="overflow: auto; padding: 4px; font-size: 12px;">${params.value}</p>
                               </div>`;

        this.btnLn = this.eGui.querySelector('.copy-button-selector');
        this.btnLn.onclick = ()=> { 
            navigator.clipboard.writeText(params.value);
            showSnackBack();
        };

        this.btnRn = this.eGui.querySelector('.view-button-selector');
        this.btnRn.onclick = ()=> {
            sessionStorage.setItem(JSON_STRING_KEY, params.value.toString());

            viewJson();
        };
    }

    getGui() {
        return this.eGui;
    }

    refresh() {
        return false;
    }

    destroy() {
    }
}
// #endregion


// #region Setup
function setupFileInput() {
    const fileInput = document.getElementById('FileInputId');
    fileInput.addEventListener('change', function () {
        let fr = new FileReader();
        fr.onload = function () {
            onLoadFileInput(fr.result);
        };
    
        fr.readAsText(this.files[0]);
    });
}

function setupToggleButtons() {
    const firstButton = document.getElementById('PreviewJsonButtonId');
    firstButton.onclick = ()=> { 
        toggleButton(PREVIEW_JSON_OPTION);
        previewJson();
    };

    const secondButton = document.getElementById('BeautifyJsonButtonId');
    secondButton.onclick = ()=> { 
        toggleButton(BEAUTIFY_JSON_OPTION);
        beautifyJson();
    };
}

function setupDataGrid() {
    // Define the columns for the ag-Grid
    const columnDefs = [
        //{ headerName: 'Epoch', field: 'epoch', minWidth: 160, maxWidth: 160 },
        { headerName: 'Microseconds', field: 'microseconds', tooltipField: "date_time", minWidth: 215, maxWidth: 215, cellRenderer: MicrosecondsCell },
        //{ headerName: 'Hours', field: 'hours', minWidth: 100, maxWidth: 100 },
        //{ headerName: 'Minutes', field: 'minutes', minWidth: 100, maxWidth: 100 },
        //{ headerName: 'Seconds', field: 'seconds', minWidth: 100, maxWidth: 100 },
        //{ headerName: 'Microseconds', field: 'microseconds', minWidth: 130, maxWidth: 130 },
        { headerName: 'Type', field: 'type', minWidth: 140, maxWidth: 140, cellRenderer: TypeCell },
        //{ headerName: 'CID', field: 'customer_id', minWidth: 100, maxWidth: 100 },
        { headerName: 'Text', field: 'text', minWidth: 240, maxWidth: 240, cellRenderer: TextCell },
        { headerName: 'Json', field: 'json', minWidth: 410, maxWidth: 410, cellRenderer: JsonCell }
    ];
    
    // Grid options
    const gridOptions = {
        columnDefs: columnDefs,
        rowHeight: 50,
        rowData: [
            {
                microseconds: 1729232894123456,
                date_time: '2024-10-18T06:28:14.123456Z',
                type: 'Info',
                customer_id: 1052,
                text: '',
                json: '{}'
            }
        ],
        defaultColDef: {
            sortable: true, filter: true, floatingFilter: true
        }
    };

    // Wait for the document to be ready, then initialize the grid
    document.addEventListener('DOMContentLoaded', function () {
        const gridDiv = document.querySelector('#LogsDataGrid');
        myAgGrid = agGrid.createGrid(gridDiv, gridOptions);
    });
}

function updateDataGrid(rowData) {
    sessionStorage.setItem(JSON_STRING_KEY, '{}');
    viewJson();
    
    if (myAgGrid) {
        myAgGrid.setGridOption('rowData', rowData);
    }
}

setupDataGrid();
setupFileInput();
setupToggleButtons();
// #endregion