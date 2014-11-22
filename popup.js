/**
 * Iinitialize
**/
var itemsTimers = [];
var timers = [];
var bg = chrome.extension.getBackgroundPage();
var search = null;
getDownloads();

/**
 * Languages definition
**/
var E_STATUS = { 
		complete: 		'Terminé',
		in_progress: 	'En cours &hellip;',
		interrupted: 	'Interrompu',
		paused:			'En pause',
		fail:			'Échec',
		deleted:		'Supprimé'
	};

var E_ACTIONS = {
		retry:			'Réessayer',
		download:		'Télécharger à nouveau',
		show:			'Localiser',
		erase:			'Retirer',
		pause:			'Mettre en pause',
		resume:			'Reprendre',
		cancel:			'Annuler'
	};

/**
 * Utils functions
**/
function byte_format(bytes) {
	if (!bytes) return "0 B";
	if (bytes < 1024*1000) return (bytes/1024).toFixed() + " Ko";
	if (bytes < 1024*1000*10) return (bytes/1024/1024).toFixed(1) + " Mo";
	if (bytes < 1024*1024*1000) return (bytes/1024/1024).toFixed() + " Mo";
	if (bytes < 1024*1024*1024*1000) return (bytes/1024/1024/1024).toFixed(1) + " Go";
	return bytes + " o";
}

function time_format(s) {
	if (s < 60) return Math.ceil(s) + " secs";
	if (s < 60*5) return Math.floor(s/60) + " mins " + Math.ceil(s%60) + " secs";
	if (s < 60*60) return Math.ceil(s/60) + " mins";
	if (s < 60*60*5) return Math.floor(s/60/60) + " heures " + (Math.ceil(s/60)%60) + " mins";
	if (s < 60*60*24) return Math.ceil(s/60/60) + " heures";
	return Math.ceil(s/60/60/24) + " jours";
}

function getClosestItem(el) {
	do {
		if (el.hasAttribute('data-item')) {
			return el;
		}
	} while (el = el.parentElement);
}

// Search for downloads and show them
function getDownloads() {
	chrome.downloads.search({ limit:0 }, function () {
		chrome.downloads.search({ 
				limit: parseInt(bg.options.maxItemsView), 
				filenameRegex: (search ? search : '.+'), 
				orderBy: ['startTime'] 
			}, 
			function(items) {
				
				if(!items.length) { // empty list
					document.querySelector('.empty-list').style.display = 'block';				
					return;
				}
				
				document.querySelector('.empty-list').style.display = 'none';	
				
				document.querySelector('.empty-list').style.display = 'none';
				var downloadsList = document.querySelector('.downloads-list');
				var template = document.querySelector('.download-model');

				items.forEach(function(element, index, array) {
					
					if(!document.querySelector('.download[data-item="'+element.id+'"]')) {
						var download = template.cloneNode(true); // Get a copy of the download item template
						download.classList.remove('download-model');
						download.classList.add('download');
						download.setAttribute('data-item', element.id);

						// Add Item to the list
						template.parentNode.insertBefore(download, template.nextSibling);
					}
					
					// Start item actualization
					actualizeItem(element.id);
					
				});
			
			}
		);
	});
}

function actualizeItem(id) {
	chrome.downloads.search({limit:0}, function() {
		chrome.downloads.search({id:id}, function(item) {

			item = item[0];

			if(!itemsTimers[item.id]) itemsTimers[item.id] = setInterval(function() {
				actualizeItem(item.id);
			}, 500);

			var download = document.querySelector('.downloads-list .download[data-item="'+item.id+'"]');
			if(download) updateItemView(download, item);

			if(item.state != 'in_progress'/*|| (item.paused /*&& item.bytesReceived == itemsTimers[item.id])*/)
				clearInterval(itemsTimers[item.id]);
		});
	});
}

function updateItemView(view, item) {
	
	var actions = [];
	
	var filename = bg.filename(item.filename);
	var regexp = new RegExp(search,"gi");
	
	view.querySelector('.download-name').innerHTML = filename.replace(regexp, '<strong>$&</strong>');
	view.querySelector('.download-status').innerHTML = E_STATUS[item.state];
	
	chrome.downloads.getFileIcon(item.id, {}, function (src) {
		if (src) view.querySelector('.download-icon').src = src;
	});
	
	view.className = '';
	view.classList.add('download');
	
	if(!item.exists) {
		view.classList.add('download-deleted');
		view.querySelector('.download-status').innerHTML = E_STATUS['deleted']
		actions.push('download', 'erase');
	}
	
	else if(item.state == 'in_progress') {
		
		var status = byte_format(item.bytesReceived)+'/'+byte_format(item.fileSize);
		
		if(item.paused) {
			view.classList.add('download-paused');
			view.querySelector('.download-status').innerHTML = status + ' - <span>'+E_STATUS['paused']+'</span>';
			if(item.canResume) actions.push('resume','cancel');
		}
		else {
			
			view.classList.add('download-'+item.state);

			// Update downloading informations

			if(timeleft = (new Date(item.estimatedEndTime) - new Date()) / 1000)
				status += ' - '+time_format(timeleft);
			
			if(timers[item.id])
				var speed = (item.bytesReceived - timers[item.id])*2;			
			
			if(speed)
				status += ' - '+byte_format(speed)+'/s';
			
			view.querySelector('.download-status').innerHTML = status;	
			
			actions.push('pause', 'cancel');
			
			// Update bytesReceived
			timers[item.id] = item.bytesReceived;
			
		}
		
		// Update progress bar
		var width = item.bytesReceived / item.totalBytes*100;
		view.querySelector('.download-progress').style.width = width+'%';
		
	}
	
	else {
		
		// Interrupted download or incomplete one
		if(item.state == 'interrupted' || (item.state == 'complete' && item.bytesReceived < item.fileSize)) {
			view.classList.add('download-interrupted');
			view.querySelector('.download-status').innerHTML = E_STATUS['interrupted'];
			actions.push('retry', 'erase');
		}
		
		else if(item.state == 'complete') {
			view.classList.add('download-'+item.state);
			var size = byte_format(item.bytesReceived);
			view.querySelector('.download-status').innerHTML = size;
			actions.push('show', 'erase');
		}
			
	}
	
	var buttons = '';
	actions.forEach(function(action) {
		buttons += '<a href="#" data-action="'+action+'">'+E_ACTIONS[action]+'</a>';	
	});
	view.querySelector('.download-actions').innerHTML = buttons;
	
	return;
}

/**
 * On added/removed upload
**/
chrome.downloads.onCreated.addListener(getDownloads);
chrome.downloads.onErased.addListener(function(id) {
	var download = document.querySelector('.download[data-item="'+id+'"]');
	if(download) download.parentNode.removeChild(download);
	getDownloads();
});

/**
 * On upload updated
**/
chrome.downloads.onChanged.addListener(function(e) {
	actualizeItem(e.id);
});

/**
 * "Erase all" button
**/
document.querySelector('#clean').addEventListener('click', function(e) {
	chrome.downloads.search({}, function (results) {		
		var running = results.map(function (item) {
			// collect downloads in progress
			if (item.state == 'in_progress') 
				return true;
			
			chrome.downloads.erase({ id: item.id });
		});
		
		if(running.length)
			getDownloads();

	});
});

/**
 * On search
**/
searchfield = document.querySelector('.downloads-search');
searchfield.addEventListener('input', function(e) {

	search = searchfield.value;

	var downloads = document.querySelectorAll('.download');	
	for(i in downloads) {

		if(downloads[i] instanceof HTMLElement)
			downloads[i].parentNode.removeChild(downloads[i]);
	}
	getDownloads();

});

/**
 * Show/hide options parameters
**/
document.querySelector('#options').addEventListener('click', function(e) {
	
	var titleNode = document.querySelector('#title');
	var buttonNode = document.querySelector('#options');
	
	var title = titleNode.innerHTML;
	var legend = buttonNode.innerHTML;
	
	titleNode.innerHTML = legend;
	buttonNode.innerHTML = title;
	
	var cleanButton = document.querySelector('#clean');
	var optionsList = document.querySelector('.options-list');
	var downloadsList = document.querySelector('.downloads-list');
	var searchfield = document.querySelector('.downloads-search');
		
	if(!optionsList.style.display || optionsList.style.display == 'none') {
		optionsList.style.display = 'block';
		downloadsList.style.display = 'none';
		searchfield.style.display = 'none';
		cleanButton.style.display = 'none'
	}
	else {
		optionsList.style.display = 'none';
		downloadsList.style.display = 'block';
		searchfield.style.display = 'block';
		cleanButton.style.display = 'block'
	}
		
});

/**
 * Show downloads page
**/
document.getElementById("show-all").onclick = function (e) { 
	chrome.tabs.create({url:e.target.href,selected:true})
};

/**
 * Detect popup open/close
**/
window.addEventListener("DOMContentLoaded", function () {
	chrome.runtime.sendMessage("popup:open");
	
	// Items interactions
	var downloadsList = document.querySelector('.downloads-list');
	downloadsList.addEventListener('click', function(e) {
		
		var download = getClosestItem(e.target);
		if(download != downloadsList) {
			
			var id = parseInt(download.getAttribute('data-item'));
						
			if(e.target.hasAttribute('data-action')) {
				var action = e.target.getAttribute('data-action');
				
				if(/resume|cancel|pause|retry|download|erase|show/.test(action)) {
					
					if(action == 'download' || action == 'retry') { // Restart download
						chrome.downloads.search({id:id}, function(item) {
							if(!item.length) {
								download.parentNode.removeChild(download);
								return;
							}
							
							item = item[0];
							chrome.downloads.download({url:item.url});
							chrome.downloads.erase({id:item.id});
					  	});
					}
					
					else if(action == 'erase') { // erase item
						chrome.downloads.erase({id:id});
					}
					
					else {
						chrome.downloads[action](id);
					}	

					return;
				}
			}
			
			chrome.downloads.search({id:id}, function(item) {
			
				if(!item.length) {
					item.parentElement.removeChild(item);
					return;
				};

				item = item[0];

				if(item.state == 'complete')
					chrome.downloads.open(item.id);
			});
			
		}
		
	});
	
	// Options management
	var optionsFields = document.querySelectorAll('.options-list input[type="checkbox"], .options-list select');
	for(opt in optionsFields) {
		if(opt != 'length') {
			
			if(optionsFields[opt].hasAttribute('type') && optionsFields[opt].getAttribute('type') == 'checkbox') {
				optionsFields[opt].checked = bg.options[optionsFields[opt].name];
			}
			else {
				optionsFields[opt].value = bg.options[optionsFields[opt].name];
			}
			
			optionsFields[opt].addEventListener('change', function(e) {
				
				var field = e.target;
				if(field.hasAttribute('type') && field.getAttribute('type') == 'checkbox') {
					var value = field.checked;
				}
				else {
					bg.console.log(field.value);
					var value = field.value;
				}
				
				localStorage[e.target.name] = value;
				bg.chrome.extension.sendMessage("settings:update");
				getDownloads();
			});
		}
	}
});
window.addEventListener("unload", function () {
	bg.chrome.extension.sendMessage("popup:close");
});