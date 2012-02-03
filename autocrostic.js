// licensed GPLv2

var demoMode = false;
var revisionNumber = 0;    // lockfree counter
var updateSec = 1;         // dynamic poll rate
var stateList = [];        // {char, gText, cText, label, num, nextClue, dirty}
var clueDict = {};         // label:text
var activeRequest = null;  // heavy reuse
var activeFlag = false;    // probably unnecessary

function makeHttpObject()
{
    try {return new XMLHttpRequest();}
    catch (error) {}
    try {return new ActiveXObject("Msxml2.XMLHTTP");}
    catch (error) {}
    try {return new ActiveXObject("Microsoft.XMLHTTP");}
    catch (error) {}
    throw new Error("Could not create HTTP request object.");
}

function ById(name)
    {return document.getElementById(name);}

function get(url, callBack)
// callback takes json as arg
{
    if (activeFlag)
        {return;}
    if (activeRequest === null)
        {activeRequest = makeHttpObject();}
    activeRequest.open("GET", url, true);
    activeRequest.onreadystatechange = function() {
	//if (activeRequest.readyState === 4 && activeRequest.status === 200)
	if (activeRequest.readyState === 4)
        {
            var json = activeRequest.responseText;
            callBack(json);
        }
    };
    activeRequest.send(null);
}

function put(url, callBack, data)
// callback takes no args
{
    if (demoMode)
        {return;}
    if (activeRequest === null)
        {activeRequest = makeHttpObject();}
    if (activeFlag)
        {activeRequest.abort();}
    activeFlag = true;
    activeRequest.open("PUT", url, true);
    activeRequest.setRequestHeader("Content-Type", "text/plain");
    activeRequest.setRequestHeader("Content-Length", data.length);
    activeRequest.onreadystatechange = function() {
	if (activeRequest.readyState === 4)
            {activeFlag = false; callBack();}
    };
    activeRequest.send(data);
    //alert(data);
}

function post(url, callBack, data)
// callback takes no args
{
    if (demoMode)
        {return;}
    if (activeRequest === null)
        {activeRequest = makeHttpObject();}
    if (activeFlag)
        {activeRequest.abort();}
    activeFlag = true;
    //var data = "sync=" + sync + "&chars=" + chars;
    activeRequest.open("POST", url, true);
    activeRequest.setRequestHeader("Content-Type", "application/x-www-form-urlencoded");
    activeRequest.onreadystatechange = function() {
	if (activeRequest.readyState === 4)
            {activeFlag = false; callBack();}
    };
    activeRequest.send(data);
}

function forEachA(obj, fn) 
{
    var mapArray = [];
    for (var i = 0, iLim = obj.length; i < iLim; i++)
        {mapArray.push(fn(obj[i]));}
    return mapArray;
}

function forEachO(obj, fn)
{
    var mapObj = {};
    for (var prop in obj)
    {
        if (obj.hasOwnProperty(prop))
            {mapObj[prop] = fn(prop, obj[prop]);}
    }
    return mapObj;
}

function setNodeAttribute(node, k, v)
{
    if (k === "class")
        {node.className = v;}
    else if (k === "checked")
        {node.defaultChecked = v;}
    else if (k === "for")
        {node.htmlFor = v;}
    else if (k === "style")
        {node.style.cssText = v;}
    else
        {node.setAttribute(k, v);}
}

function dom(name, attributes)
// attributes is object, extra args become children
{
    var node = document.createElement(name);
    if (attributes)
    {
        forEachO(attributes,
                function(k, v) {setNodeAttribute(node, k, v);});
    }
    for (var i = 2; i < arguments.length; i++)
    {
        var child = arguments[i];
        if (typeof child === "string")
            {child = document.createTextNode(child);}
        node.appendChild(child);
    }
    return node;
}

function tdContents(td)
{
    if (td.className === "filled")
        {return "█";}
    var c = td.firstChild.value;
    if (c === "")
        {return "_";}
    if (c === " ")
        {return "_";}
    return c;
}

function gridExport()
{ 
    var tr = ById("grid").getElementsByTagName("tr");
    var gridCSV = [];
    // forEach this
    for (var i=0, iLim=tr.length; i<iLim; i++)
    {
        var td = tr[i].getElementsByTagName("td");
        gridCSV.push(forEachA(td, tdContents).join(","));
    }
    //return gridCSV.join("\n");
    alert(gridCSV.join("\n"));
}

function createCell(stateList, currentRow)
{
    var i = stateList.length;
    stateList.push({"char":"", "label":"", "num":0,  
                    "gText":null, "cText":null, "nextClue":0,
                    "dirty":false});
    stateList[i].num = i;
    var td = dom("td", {"class":"blank"});
    currentRow.appendChild(td);
    var text = dom("input", {"type":"text", "size":1, /*"maxlength":1,*/
                   "onKeyUp":"gridKey("+i+");", "class":"blurred",
                   "onMouseOver":"inputClass("+i+",\"focused\");",
                   "onMouseOut": "inputClass("+i+",\"blurred\");"});
    // see stackoverflow.com/questions/3362/ for possible IE trickery
    text.addEventListener("keydown", 
        function (e) {keyNav("g",e,i-1,i,i+1);}, false);
    td.appendChild(text);
    stateList[i].gText = text
}

function parseSource(source)
// source json is meant to be easy to type
// thus there is a lot of messy stuff to do here
{
    stateList.push(null);
    var tbody = dom("tbody")
    ById("grid").appendChild(dom("table", null, tbody));
    for (var row = 0; row < source.grid.length; row++)
    {
        var tr = dom("tr");
        tbody.appendChild(tr);
        for (var col = 0; col < source.grid[row].length; col++)
        {
            if (col !== 0)
            {
                var td = dom("td", {"class":"filled"}, "X");
                tr.appendChild(td);
            }
            for (var cell = 0; cell < source.grid[row][col]; cell++)
                {createCell(stateList, tr);}
        }
    }
}

function parseClues(source)
// source json is meant to be easy to type
// thus there is a lot of messy stuff to do here
{
    ul = dom("ul");
    ById("clues").appendChild(ul);
    var lClue = 0;
    for (var row = 0; row < source.clues.length; row++)
    {
        var li = dom("li");
        ul.appendChild(li);
        li.appendChild(dom("span", {"class":"label",
                       /*"title":source.clues[row][1]*/},
                       source.clues[row][0]));
	clueDict[source.clues[row][0]] = source.clues[row][1];
        for (var col = 2; col < source.clues[row].length; col++)
        {
            var i = source.clues[row][col];
            // yuck
            var rClue = 0;
            if (col+1 === source.clues[row].length)
            {
                if (row+1 === source.clues.length)
                    {rClue = source.clues[0][2];}
                else
                    {rClue = source.clues[row+1][2];}
            }
            else
                {rClue = source.clues[row][col+1];}
            stateList[i].nextClue = rClue;
            var text = dom("input", {"type":"text", "size":1, /*"maxlength":1,*/
                           /*"title":source.clues[row][1],*/ "class":"blurred",
                           "onKeyUp":"clueKey("+i+");",
                           "onMouseOver":"inputClass("+i+",\"focused\");",
                           "onMouseOut": "inputClass("+i+",\"blurred\");"});
            text.addEventListener("keydown", clueNavGen(lClue, i, rClue), false);
	    stateList[i].label = source.clues[row][0];
            li.appendChild(text);
            stateList[i].cText = text;
            lClue = Number(i);
        }
        ul.appendChild(document.createTextNode(" "));
    }
}

function clueNavGen(lClue, i, rClue)
{
    return function(e) {keyNav("c", e, lClue, i, rClue)};
}

function inputClass(i, className)
{
    setNodeAttribute(stateList[i].gText, "class", className);
    setNodeAttribute(stateList[i].cText, "class", className);
    if (className === "focused")
        {showClue(i);}
}

function showClue(i)
{
    var ct = ById("clueText");
    ct.removeChild(ct.firstChild);
    ct.appendChild(document.createTextNode(clueDict[stateList[i].label]));
}

function nowString()
{
    var now = [" "];
    for (var i=1; i < stateList.length; i++)
    {
        var c = stateList[i].char
        if (c === "")
            {c = " ";}
        now.push(c);
    }
    return now.join("");
}

function getState(now)
{
    if (now.length)
    {
        now = now.split("\n");
        now[0] = Number(now[0]);
        updateAll(now[0], now[1]);
        if (now[0] !== revisionNumber)
	{
            updateSec = 1;
            return 1;
        }
    }
    updateSec = min(20, updateSec+1);
    return 0;
}

function putState(now)
{
    var next = [(revisionNumber + 1) % 1000, nowString()];
    revisionNumber = next[0];
    var nextString = next[0].toString() + "\n" + next[1];
    put(shareURL, function () {;}, nextString); 
}

function postState(now)
{
    var next = [(revisionNumber + 1) % 1000, nowString()];
    revisionNumber = next[0];
    var nextString = "sync=" + next[0].toString() + "&chars=" + next[1];
    post(postURL, function () {;}, nextString); 
}

function updateLoop()
{
    if (! activeFlag)
        {get(shareURL, getState);}
    setTimeout(updateLoop, updateSec*1000);
}

function updateAll(revNum, stateString)
// Lockfree updating.  A malicious client could wreck this.
// But much faster/simpler than doing it server side.
// (Run on lan or behind pw-wall.)
{
    var anyDirty = false;
    for (var i=1, iLim=stateList.length; i<iLim; i++)
    {
        if (stateList[i].char === stateString[i])
            {stateList[i].dirty = false;}
        if (stateList[i].char === "" && stateString[i] === " ")
            {stateList[i].dirty = false;}
        if (stateList[i].dirty)
            {anyDirty = true; continue;}
        updateOne(i, stateString[i]);
    }
    if (anyDirty)
        {putState("")};
    /*
    if ((revNum - 1 % 1000) === revisionNumber)  // client wins the lock
    {
	for (var i=1, iLim=stateList.length; i<iLim; i++)
            {updateOne(i, stateString[i]);}
    }
    else if (revNum < revisionNumber)  // client is typing
    {
	for (var i=1, iLim=stateList.length; i<iLim; i++)
	{
	    if (stateList[i].char === "")
	        {updateOne(i, stateString[i]);}
	}
    }
    else if ((revNum + 1 % 1000) === revisionNumber)  // merge update from server
    {
        revisionNumber = revNum;
        for (var i=1, iLim=stateList.length; i<iLim; i++)
	    {updateOne(i, stateString[i]);}
	//{
	//    if (stateString[i] !== "")
	//        {updateOne(i, stateString[i]);}
	//}
    }
    else if (revNum > revisionNumber)  // force update from server
    {
	revisionNumber = revNum;
	for (var i=1, iLim=stateList.length; i<iLim; i++)
	    {updateOne(i, stateString[i]);}
    }
    else if (revNum === revisionNumber)  // enforce consistency
    {
	for (var i=1, iLim=stateList.length; i<iLim; i++)
	    {updateOne(i, stateString[i]);}
    }
    //revisionNumber = revNum;
    //for (var i=1, iLim=stateList.length; i<iLim; i++)
    //    {updateOne(i, stateString[i]);}
    */
}

function updateOne(cellNum, character)
{
    if (character === " ")
        {character = "";}
    stateList[cellNum].cText.value = character;
    stateList[cellNum].gText.value = character;
    stateList[cellNum].char = character;
}

function keyNav(mode, e, l, num, r)
{
    var TAB = 9;
    var BACK = 8;
    var LEFT = 37;
    var RIGHT = 39;
    if (mode === "g")
        {focus = function (i) {stateList[i].gText.focus();};}
    else if (mode === "c")
        {focus = function (i) {stateList[i].cText.focus();};}
    else
        {return;}
    //alert(l + " " + num + " " + r);  // 91 91 175 every time
    if (e.keyCode === TAB)
        {showClue(r); return;}
    if (e.keyCode === BACK && stateList[num].char === "")
    {
        updateOne(l, "");
        stateList[l].dirty = true;
        focus(l);
	showClue(l);
        putState("");
    }
    if (e.keyCode === LEFT)
        {focus(l); showClue(l);}
    if (e.keyCode === RIGHT)
        {focus(r); showClue(r);}
}

function gridKey(cellNum)
{
    if (stateList[cellNum].gText.value === stateList[cellNum].char)
        {return;}
    // this bit gets around really fast typing
    if (stateList[cellNum].gText.value.length > 1)
    {
        var temp = stateList[cellNum].gText.value;
        for (var i=0, iLim=temp.length; i<iLim; i++)
        {
            if (i===0 && iLim===2 && temp.charAt(0)===stateList[cellNum].char)
            // overwrite character 
            {
                stateList[cellNum].gText.value = temp.charAt(1);
                stateList[cellNum].dirty = true;
                cellNum++;
                break;
            }
            stateList[cellNum].gText.value = temp.charAt(i);
            stateList[cellNum].dirty = true;
            cellNum++;
        }
        cellNum--;
    }
    //updateOne(cellNum, stateList[cellNum].gText.value);
    stateList[cellNum].dirty = true;
    // overkill, but otherwise fast presses are ignored
    for (var i=1, iLim=stateList.length; i<iLim; i++)
        {updateOne(i, stateList[i].gText.value);}
    if (stateList[cellNum].gText.value.length !== 0)
	{stateList[cellNum+1].gText.focus();}
    //get(shareURL, putState);
    putState("");
}

function clueKey(cellNum)
{
    if (stateList[cellNum].cText.value === stateList[cellNum].char)
        {return;}
    // this bit gets around really fast typing
    if (stateList[cellNum].cText.value.length > 1)
    {
        var temp = stateList[cellNum].cText.value;
        var prevNum = cellNum
        for (var i=0, iLim=temp.length; i<iLim; i++)
        {
            if (i===0 && iLim===2 && temp.charAt(0)===stateList[cellNum].char)
            // overwrite character 
            {
                stateList[cellNum].cText.value = temp.charAt(1);
                stateList[cellNum].dirty = true;
                prevNum = cellNum;
                cellNum = stateList[cellNum].nextClue;
                break;
            }
            stateList[cellNum].cText.value = temp.charAt(i);
            stateList[cellNum].dirty = true;
            prevNum = cellNum;
            cellNum = stateList[cellNum].nextClue;
        }
        cellNum = prevNum;
    }
    //updateOne(cellNum, stateList[cellNum].cText.value);
    stateList[cellNum].dirty = true;
    // overkill, but otherwise fast presses are ignored
    for (var i=1, iLim=stateList.length; i<iLim; i++)
        {updateOne(i, stateList[i].cText.value);}
    if (stateList[cellNum].cText.value.length !== 0)
	{stateList[stateList[cellNum].nextClue].cText.focus();}
    //get(shareURL, putState);
    putState("");
}

function childrenWidth(elem)
{
    var total = 0;
    var cn = elem.childNodes;
    for (var i=0, iLim=cn.length; i<iLim; i++)
        // figure out how to forEach this
        {total += cn[i].offsetWidth + 2;}
    // array.reduce(function (a, b) {return a + b;  ?}
    return total;
}

function refitColumns()
{
    var widths = [];
    var lis = ById("clues").getElementsByTagName("li");
    for (var i=0, iLim=lis.length; i<iLim; i++)
        // and for some really odd reason, this does not forEach
        {widths.push(childrenWidth(lis[i]));}
    var columns = Math.floor(ById("clues").offsetWidth / Math.max.apply(Math, widths));
    ById("clues").style.columnCount = columns;
    ById("clues").style.MozColumnCount = columns;
    ById("clues").style.WebkitColumnCount = columns;
}

function main(source)
{
    source = eval( "(" + source + ")" );  // don't hate me
    parseSource(source);
    parseClues(source);
    refitColumns();
    updateLoop();
    window.onresize = refitColumns;
    //alert("Init finished.");
}

