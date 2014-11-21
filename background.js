// Define constants
var NOTIFICATIONS_ID = 'dl';
var ICON_DEFAULT_COLOR = "#5e5e5e";
var ICON_DISABLED_COLOR = "#aaa";
var ICON_PROGRESS_BACKGROUND_COLOR = "#c0c0c0";
var ICON_PROGRESS_DEFAULT_COLOR = "#2566ff";
var ICON_PROGRESS_PAUSED_COLOR = "#cba303";


// Settings définition
var options = {
	enableNotificationOnComplete: 	true,
	hideInterrupted: 				false,
	maxItemsView: 					15,
	disableDefaultView: 			true
};

options = getOptions(options);

// define parameters
var isPopupOpen = false;
var updating	= null;

// Enable/Disable default download system
chrome.downloads.setShelfEnabled(!options.disableDefaultView);

// Generate icon canvas
var canvas = document.createElement('canvas');
canvas.width = 38;
canvas.height = 38;
var icn = canvas.getContext('2d');

var scale = (window.devicePixelRatio < 2) ? 0.5 : 1;
var size = 38 * scale;

icn.scale(scale, scale);

// Define icon
setDefaultIcon();

// Run once
update();


/**
 * New upload added
**/
chrome.downloads.onCreated.addListener(update);

/**
 * Update icon state
**/
function update() {
	chrome.downloads.search({ 
		
		state: 'in_progress'/*, 
		paused: false*/
		
	}, function(items) {
		
		if (!items.length) {
			
			clearInterval(updating);
			updating = null;
			setDefaultIcon();
			return;
			
		}

		if (!updating) 
			updating = setInterval(update, 500);

		var total = 0;
		var current = 0;
		var paused = null;
		var running = false;
		
		items.forEach(function (e) {
			
			current += e.bytesReceived;
			total += e.totalBytes;
			
			if(!e.paused) running = true;
			if(!running && e.paused && e.canResume) paused = true;
			else paused = false;
		});
		
		var progress = current / total;

		setProgressIcon(progress, paused)
		
	});
}

/**
 * Manage custom events
**/
chrome.runtime.onMessage.addListener(function (message) {
	
	// Update settings
	if(message == 'settings:update') {
		options = getOptions(options);		
		chrome.downloads.setShelfEnabled(!options.disableDefaultView);
	} 
	
	// Open/close popup
	else if (message == 'popup:open') {
		isPopupOpen = true;
	} else if ('popup:close' == message) {
		isPopupOpen = false;
	}
});


/**
 * On state change
**/
chrome.downloads.onChanged.addListener(function(delta) {
	if(delta.state) {
		
		// Complete
		if(delta.state.current == 'complete' && delta.state.previous == 'in_progress') {
			
		 	// Download failed
			if(delta.bytesReceived < delta.fileSize) {
				var title = 'Échec du téléchargement';
				console.log(title);
			}
			
			// Download complete
			else if(options.enableNotificationOnComplete && !isPopupOpen) {
				var title = 'Téléchargement terminé';
				
			}
			
			if(title) {
				chrome.downloads.search({id:delta.id}, function(item) {
					
					chrome.downloads.getFileIcon(delta.id, {}, function (src) {
						
						
						
						chrome.notifications.create(NOTIFICATIONS_ID+item[0].id,  {
							type: "basic",
							eventTime: Date.now() + 1000,
							iconUrl: (src ? src : 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7'),
							title: title, 
							message: item[0].filename,
						}, function() {});

					});

				});	
			}
		}
	}
	
	 // On pause : update icon
	if(delta.paused)
		update();	
});

/**
 * Open file from notifications
**/
chrome.notifications.onClicked.addListener(function(nid) {
	
	if(nid.substr(0,NOTIFICATIONS_ID.length) == NOTIFICATIONS_ID) {
		
		var id = parseInt(nid.substr(2, nid.length));
		
		chrome.downloads.search({ id:id }, function(item) {
			
			// Restart failed download
			if(item[0].bytesReceived < item[0].fileSize) {
				chrome.downloads.download({url:item[0].url});
				chrome.downloads.erase({id:item[0].id});	
			}
				
			// Open file
			else if(item[0].state == 'complete' && item[0].exists)
				chrome.downloads.open(item[0].id);
			
		});
		
	}
	
});

/**
 * Icon draw
**/
function setDefaultIcon() { // default icon
		
	icn.clearRect(0, 0, 38, 38);
	
	icn.strokeStyle = ICON_DEFAULT_COLOR;
	icn.fillStyle = ICON_DEFAULT_COLOR;
	icn.lineWidth=10;
	icn.beginPath();
	icn.moveTo(19,3);
	icn.lineTo(19,22);
	icn.stroke();

	icn.moveTo(6,18);
	icn.lineTo(32,18);
	icn.lineTo(18,32);
	icn.fill(); 

	var icon = { imageData: {} };
	icon.imageData[size] = icn.getImageData(0,0,size,size);
	chrome.browserAction.setIcon(icon);
	
}

function setProgressIcon(progress, paused) { // progression icon
	
	var w = progress * 38

	icn.clearRect(0, 0, 38, 38);

	icn.lineWidth = 2;
	icn.fillStyle = ICON_PROGRESS_BACKGROUND_COLOR;
	icn.fillRect(0,28,38,12);

	icn.fillStyle = (paused ? ICON_PROGRESS_PAUSED_COLOR : ICON_PROGRESS_DEFAULT_COLOR);
	icn.fillRect(0,28,w,12);

	icn.strokeStyle = ICON_DEFAULT_COLOR;
	icn.fillStyle = ICON_DEFAULT_COLOR;
	icn.lineWidth=10;
	icn.beginPath();
	icn.moveTo(20,0);
	icn.lineTo(20,14);
	icn.stroke();

	icn.moveTo(6,10);
	icn.lineTo(34,10);
	icn.lineTo(20,24);
	icn.fill(); 
	 
	var icon = { imageData: {} };
	icon.imageData[size] = icn.getImageData(0,0,size,size);
	chrome.browserAction.setIcon(icon);
	
}