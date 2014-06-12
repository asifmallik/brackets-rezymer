/*global $, define, brackets*/

define(function (require, exports, module) {
	"use strict";
	
	//Brackets Modules
	var CommandManager = brackets.getModule("command/CommandManager"),
		Menus = brackets.getModule("command/Menus"),
		ModalBar = brackets.getModule("widgets/ModalBar").ModalBar,
		EditorManager = brackets.getModule("editor/EditorManager"),
        ExtensionUtils = brackets.getModule("utils/ExtensionUtils"),
		NodeDomain = brackets.getModule("utils/NodeDomain");
		
	//Rezymer Ids
    var RezymerMenuID = "rezymer-menu",
        RezymerMenu = Menus.addMenu("Rezymer", RezymerMenuID);
	
	
	//Other "Global" Varables
	var HTMLQueryModalBar,
		RezymerDomain = new NodeDomain("Rezymer", ExtensionUtils.getModulePath(module, "domain")),
		prevQuery,
		selections = [],
		selectionIndex = 0;
	
	//Rezymer Functions
	/**
         * Converts character index to line and character index
         *
         * @param: Array of line lengths
         * @param: Character index
     */
	function charToLineChar(lineLengths, char) {
		for (var i = 0; char > lineLengths[i]; i++){
			char-=(lineLengths[i]+1);
		}
		return {
			line: i,
			ch: char
		}
	}
	
	/**
         * Sets selections to CodeMirror
         *
         * @param: Editor instance
         * @param: Array of line lengths
         * @param: Selections to be formatted and set as selections
     */
	function setCMSelections(editor, lineLengths, unformattedSelections){
		selections = [],
		selectionIndex = 0;
		$("#find-counter").html(unformattedSelections.length + ((unformattedSelections.length === 1) ? " selection" : " selections"));
		if(unformattedSelections.length === 0){
			$("#find-next, #find-prev").attr("disabled", "");
			return;
		} 
		unformattedSelections.forEach(function(unformattedSelection){ //Iterates through every selection
			selections.push({
				start: charToLineChar(lineLengths, unformattedSelection.openingTag.start),
				end: charToLineChar(lineLengths, unformattedSelection.openingTag.end)
			});
			if(unformattedSelection.closingTag){
				selections.push({
					start: charToLineChar(lineLengths, unformattedSelection.closingTag.start),
					end: charToLineChar(lineLengths, unformattedSelection.closingTag.end)
				});
			}
		});
		editor.setSelections(selections);
		$("#find-next, #find-prev").removeAttr("disabled");
        editor._codeMirror.scrollIntoView({from: selections[0].start, to: selections[0].end});
	}
	/**
         * Queries HTML Document 
         *
         * @param: Query
		 * @param: Will document be modified?
     */
	function queryDocument(query, modify, editor) {
		
		if (query === "" || (query === prevQuery && !modify)) return;//Return if query is empty or equal to previous query(and if modify is set to false)
		
		var editor = EditorManager.getActiveEditor(),
			content = editor._codeMirror.getValue(),
			EOL = "\n",
			lines,
			lineLengths,
			modificationOptions = [];
		editor._codeMirror.setSelections([]); //Removes previous selections
		
		if(!modify){
			lines = content.split(EOL);
			lineLengths = lines.map(function(l) {
				return l.length;
			});
			RezymerDomain.exec("rezymer.HTMLQuery",
							   query
							  ).done(function(selections) {
									setCMSelections(editor, lineLengths, selections);
			});
		}else{
			$("#method_table tr").each(function(){
				var methodInput = $(this).find(".method_input"),
					argsInput = $(this).find(".arguments_input"),
					methodName = methodInput.val().trim(),
					args,
					modificationOption = {};
				
				//Return if methodName string is empty
				if(methodName === "")
					return;
				
				//If arguments input is not empty parse arguments
				if(argsInput.val().trim() !== ""){
					args = argsInput.val().trim().split(",").map(function(arg){ //Parses each argument
						return JSON.parse(arg);
					});
				}
				
				modificationOption.methodName = methodName;
				modificationOption.arguments = args || {}; //If args is undefined set arguments to empty object
				modificationOptions.push(modificationOption);
			});
			RezymerDomain.exec("rezymer.HTMLQueryModify", query, modificationOptions)
			.done(function(newContent){
				RezymerDomain.exec("rezymer.HTMLParse", newContent); //Refresh Parsed HTML
				editor._codeMirror.setValue(newContent);
				lines = newContent.split(EOL);
				lineLengths = lines.map(function(l) {
					return l.length;
				});
				RezymerDomain.exec("rezymer.HTMLQuery",
							   query
							  ).done(function(selections) {
									setCMSelections(editor, lineLengths, selections);
			});
			});
		}
		prevQuery = query; //Current query becomes previous query.
		
	}

	//Commands and Menu
	var CMD_QUERY_ID = "rezymer.HTMLQuery";
	CommandManager.register("Query HTML", CMD_QUERY_ID, function(){
		var editor = EditorManager.getActiveEditor();
		if(!editor) return; //Continue only if any file is open
		HTMLQueryModalBar = new ModalBar(require("text!htmlContent/html-query-modal-bar.html"), true);
		RezymerDomain.exec("rezymer.HTMLParse", editor._codeMirror.getValue());
		//Sets prevQuery to null when the modal bar is closed
		$(HTMLQueryModalBar).on("close", function(){
			prevQuery = null;
		});
		//Event Listeners
		$("#modify_dom").change(function(){ //Listens to modify checkbox event
			if($(this).prop("checked")){ //Shows modification table if checked
				$("#method_table").show();
			}else{ //If not checked, modification table is hidden
				$("#method_table").hide();
			}
		});
		$("#html_query").keyup(function(){
				queryDocument($(this).val().trim(), false);
		});
		$("#method_table").on("click", "#modification_query_run", function(){
			queryDocument($("#html_query").val().trim(), true);
		});
		$("#method_table").on("keyup", ".last", function(){
			if($(this).val().trim()==="") return;
			//Removes "last" class, selects parent "tr" and set it to tr
			var tr = $(this).removeClass("last").parents("tr");
			tr.find("#modification_query_run").remove(); //removes run button
			tr.after('<tr><td><input class="method_input last" placeholder="Run Method..." type="text" /></td><td><input class="arguments_input" placeholder="Arguments(Seperate with comma)" type="text" /></td><td><input value="Run" type="button" style="width:100px;" class="btn primary" id="modification_query_run" /></td></tr>'); //Adds another row after tr(Should it be replaced by a seperate html document which will be required?)
		});
		$("#query_bar").on("click", "#find-prev:not([disabled])", function(){
			selectionIndex-=2;
			var i = (selectionIndex === -2) ? selectionIndex = selections.length-2 : selectionIndex;
			editor._codeMirror.scrollIntoView({from: selections[i].start, to: selections[i].end});
		});
		$("#query_bar").on("click", "#find-next:not([disabled])", function(){
			selectionIndex+=2;
			var i = (selectionIndex === selections.length) ? selectionIndex = 0 : selectionIndex;
			editor._codeMirror.scrollIntoView({from: selections[i].start, to: selections[i].end});
		});
    });
    RezymerMenu.addMenuItem(CMD_QUERY_ID, "Ctrl-Shift-R");
});