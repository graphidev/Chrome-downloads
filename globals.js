/**
 * Get the final filename
**/
function filename(filename) {
	var back_array =  filename.split('\\');
	var forward_array = filename.split('/');
	var array = back_array.length > forward_array.length ? back_array : forward_array;
	return array.pop().replace(/.crdownload$/, '');
}

/**
 * (Re)Load options
**/
function getOptions(options) {
	for(i in options) {

		if(localStorage[i] != undefined && localStorage[i] != options[i])
			options[i] = localStorage[i];
		
		switch(options[i]) {
			case 'true':
				options[i] = true;
				break;
			case 'false':
				options[i] = false;
				break;
			default:
				options[i] = options[i];
		}
		
	}
	return options;
}

/**
 * i18n
**/
function i18nhtml(){
	var message = chrome.i18n.getMessage("click_here", ["string1", "string2"]);
	document.write(message)
}
