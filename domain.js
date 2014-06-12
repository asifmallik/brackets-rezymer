/*global require, exports*/

(function(){
	"use strict";
	//Node Modules
	var cheerio = require("cheerio"),
		$;
	
	function parse(html){
		$ = cheerio.load(html, {
			decodeEntities: true
		});
	}
	
	function query(query){
		
		var selections = [];
		
		//iterates through results of query and pushes each position to selections
		$(query).each(function(i, elem){ 
			selections.push({
				openingTag: elem.openingTag,
				closingTag: (elem.closingTag ? elem.closingTag : false ) 
			});
		});
		
		return selections;
	}
	function queryModify(query, methods){
		var prevObject = $(query);
		
		//Imitates chained methods
		methods.forEach(function(method){
			prevObject = prevObject[method.methodName].apply(prevObject, method.arguments); 
		});
		
		return $.html(); //Returns new html content
	}
	function init(domainManager) {
		if (!domainManager.hasDomain("Rezymer")) {
			domainManager.registerDomain("Rezymer", {major: 0, minor: 1});
		}
		
		domainManager.registerCommand("Rezymer", "rezymer.HTMLParse", parse, false);
		domainManager.registerCommand("Rezymer", "rezymer.HTMLQuery", query, false);
		domainManager.registerCommand("Rezymer", "rezymer.HTMLQueryModify", queryModify, false);
	}
	exports.init = init;
})();