let mapboxApiKey = '';
let thunderforestApiKey = '';

const ENV = 'prod'; // Change to 'production' for the production URL

// Base URLs for each environment
const BASE_URL = ENV === 'prod'
    ? 'https://skateable.onrender.com/api'  // Production URL
    : 'http://localhost:5000/api';          // Development URL 


// Set default map options with a fallback center point (Example: Germany)
let defaultMapOptions = {
    center: [40.2137, -74.3001],  // Example fallback center point (can be customized)
    zoom: 5
};

let loggedInUser = '';
let currentMode = 'view';  // Default mode
let map = L.map('map', {
    maxZoom: 18,          // Set a maximum zoom level
    inertia: true,        // Enable inertia
    inertiaDeceleration: 2000, // Lower deceleration for smoother, slower panning
    worldCopyJump: false,  
    maxBounds: [
        [85, -180],       // Limit map bounds to prevent moving to unintended areas
        [-85, 180]
    ],
});

// Load and add the tile layer (OpenStreetMap) to the map
let osmLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { noWrap: true });
// Initialize TraceStack Topo layer
let topoLayer = L.tileLayer(`https://tile.thunderforest.com/outdoors/{z}/{x}/{y}.png?apikey=${thunderforestApiKey}`, { noWrap: true });

// Add the default (OSM) layer to the map
map.addLayer(osmLayer);

// Set up toggle switch functionality
const terrainToggle = document.getElementById('terrain-toggle');
const toggleText = document.getElementById('terrain-text');

terrainToggle.addEventListener('change', () => {
    if (terrainToggle.checked) {
        // Switch to TraceStack Topo map
        map.removeLayer(osmLayer);
        map.addLayer(topoLayer);
        toggleText.innerText = 'terrain on';
    } else {
        // Switch back to OpenStreetMap standard
        map.removeLayer(topoLayer);
        map.addLayer(osmLayer);
        toggleText.innerText = 'terrain off';
    }
});


// Function to fetch the Mapbox API key from the server
async function fetchApiKey() {
    try {
        let response = await fetch(`${BASE_URL}/mapbox-key`);
        
        // Check if the response is not ok
        if (!response.ok) {
            throw new Error(`Network response was not ok: ${response.status} ${response.statusText}`);
        }

        let data = await response.json();
        mapboxApiKey = data.apiKey;

        response = await fetch(`${BASE_URL}/thunderforest-key`);
        
        // Check if the response is not ok
        if (!response.ok) {
            throw new Error(`Network response was not ok: ${response.status} ${response.statusText}`);
        }

        data = await response.json();
        thunderforestApiKey = data.apiKey;

    } catch (error) {
        console.error('Error fetching API key:', error.message || error);
        alert('Failed to fetch the API key. Please try again later.');
        throw error;  // Re-throw to allow further handling if needed
    }
}

// Fetch the Mapbox API key on page load
fetchApiKey()
    .then(() => {
    })
    .catch(error => {
        console.error('Failed to fetch the API key:', error);
    });


// Try to get the user's location
if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(
        function(position) {
            const userCoords = [position.coords.latitude, position.coords.longitude];
            map.setView(userCoords, 5); 
        },
        function() {
            map.setView(defaultMapOptions.center, defaultMapOptions.zoom);
        }
    );
} else {
    // If geolocation is not supported, use the default center
    map.setView(defaultMapOptions.center, defaultMapOptions.zoom);
}

// Function to search location using OpenStreetMap's API
function searchLocation(query) {
    const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}`;

    fetch(url)
        .then(response => response.json())
        .then(data => {
            if (data.length > 0) {
                const { lat, lon } = data[0];
                map.setView([lat, lon], 15);
            } else {
                alert("Location not found.");
            }
        })
        .catch(error => {
            console.error('Error fetching location data:', error);
            alert("Error searching for location.");
        });
}

// Attach event listener to the search button
document.getElementById('search-button').addEventListener('click', function() {
    const query = document.getElementById('search-input').value;
    if (query) {
        searchLocation(query);
    } else {
        alert("Please enter a location.");
    }
});

// Also allow pressing 'Enter' to trigger the search
document.getElementById('search-input').addEventListener('keypress', function(e) {
    if (e.key === 'Enter') {
        const query = document.getElementById('search-input').value;
        if (query) {
            searchLocation(query);
        } else {
            alert("Please enter a location.");
        }
    }
});

//Accessibility Toggle
const accessibleToggle = document.getElementById("accessible-toggle");
let isAccessible = accessibleToggle.checked;

const accessibleColorMap = {
    yellowgreen: "#6DDE00", // Accessible version of red
    palegoldenrod: "#0EF3EE", // Accessible version of blue
    lightsalmon: "#FF1B7A", // Accessible version of green
    tomato: "#6e54ff",
    darkgreen: "#AFAFAF",
    darkgoldenrod: "#545454",
    darkred:"#000000"
};

// Routing layer where the user-created roads will appear temporarily
let temporaryRoute = null;
let routeData = null; 

let permanentRoutes = L.layerGroup().addTo(map);
let confirmRouteButton = document.getElementById('confirm-route');

let routeColorSelector = document.getElementById('route-color');
let routeBorderColorSelector = document.getElementById('route-border-color');

let routeMessageInput = document.getElementById('route-message');

// Function to add a route that snaps to the roads
function addTemporaryRoute(startPoint, endPoint) {
    // Remove any existing temporary route
    if (temporaryRoute) {
        map.removeControl(temporaryRoute);
    }

    // Custom routing plan to disable markers
    const customPlan = L.Routing.plan([L.latLng(startPoint), L.latLng(endPoint)], {
        createMarker: function() { return null; },  // Disable markers
        addWaypoints: false  // Disable waypoint dragging
    });

    // Create a new routing control using Mapbox, explicitly disabling the itinerary
    let oColor = routeBorderColorSelector.value;
    let iColor = routeColorSelector.value;

    if(isAccessible){
        oColor = accessibleColorMap[routeBorderColorSelector.value];
        iColor = accessibleColorMap[routeColorSelector.value];
    }

    temporaryRoute = L.Routing.control({
        plan: customPlan,
        router: L.Routing.mapbox(mapboxApiKey, {
            profile: 'mapbox/walking' 
        }),
        lineOptions: {
            styles: [
                { color: oColor, weight: 13 },  // Border layer
                { color: iColor, weight: 5 }  // Main route layer
            ]
        },
        fitSelectedRoutes: true,
        routeWhileDragging: false,
        itinerary: null,  
        show: false,  
    }).addTo(map);

    // Add an event listener to enable the confirm button after the route is calculated
    temporaryRoute.on('routesfound', function(e) {
        routeData = e.routes[0];
        confirmRouteButton.disabled = false;
    });
}

// Create polyline with clickable segments
function addClickableRoute(coordinates, route) {
    for (let i = 0; i < coordinates.length - 1; i++) {
        let segmentCoordinates = [coordinates[i], coordinates[i + 1]];
        let oColor = route.borderColor;
        let iColor = route.color;

        if(isAccessible){
            oColor = accessibleColorMap[route.borderColor];
            iColor = accessibleColorMap[route.color];
        }

        // Create a polyline for each segment
        let segment = L.polyline(segmentCoordinates, {
            color: oColor,
            weight: 13,
            zIndex: 1
        }).addTo(permanentRoutes);

        // Create a thinner polyline for the main line
        let mainSegment = L.polyline(segmentCoordinates, {
            color: iColor,
            weight: 5,
            zIndex: 2
        }).addTo(permanentRoutes);

        // Add a click event to show the popup for each segment
        segment.on('click', function(e) {
            L.popup()
             .setLatLng(e.latlng)
             .setContent(`<b>Message:</b> ${route.message}<br><b>User:</b> ${route.username}<br><b>Timestamp:</b> ${new Date(route.timestamp).toLocaleString()}`)
             .openOn(map);
        });

        mainSegment.on('click', function(e) {
            L.popup()
             .setLatLng(e.latlng)
             .setContent(`<b>Message:</b> ${route.message}<br><b>User:</b> ${route.username}<br><b>Timestamp:</b> ${new Date(route.timestamp).toLocaleString()}`)
             .openOn(map);
        });
    }
}

// Function to update the temporary route color dynamically
function updateTemporaryRouteStyle() {
    if (temporaryRoute) {
        // Update the line style for the existing temporary route
        temporaryRoute.getPlan().setLineOptions({
            styles: [
                { color: routeBorderColorSelector.value, weight: 13 },  
                { color: routeColorSelector.value, weight: 5 }  
            ]
        });
    }
}

// Store the route permanently by adding it to the map as a polyline
function confirmRoute() {
    if (routeData) {
        const timestamp = new Date();
        const routeMessage = routeMessageInput.value || "";  // Use a default message if none is entered
        const coordinates = routeData.coordinates.map(coord => [coord.lat, coord.lng]);

        // Send route data to backend for saving
        const routeDetails = {
            coordinates: coordinates,
            color: routeColorSelector.value,
            borderColor: routeBorderColorSelector.value,
            timestamp: timestamp,
            message: routeMessage,
            username: loggedInUser
        };

        fetch(`${BASE_URL}/routes`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(routeDetails)
        })
        .then(response => response.json())
        .then(data => console.log('Route saved.'))
        .catch(error => console.error('Error saving route:', error));

        let oColor = route.borderColor;
        let iColor = route.color;

        if(isAccessible){
            oColor = accessibleColorMap[route.borderColor];
            iColor = accessibleColorMap[route.color];
        }

        L.polyline(coordinates, {
            color: oColor.value,  // Border color
            weight: 13,  // Thicker border
            zIndex: 1   // Ensure the border is drawn beneath the main line
        }).addTo(permanentRoutes);  // Add to permanent routes layer

        // Create a polyline for the main line color with a smaller weight and higher zIndex
        const routeLine = L.polyline(coordinates, {
            color: iColor.value,  // Main color
            weight: 5,  // Thinner main line
            zIndex: 2   // Ensure the main line is drawn on top
        }).addTo(permanentRoutes);  // Add to permanent routes layer
        
        // Attach route details to the polyline for easy access in view mode
        routeLine.routeDetails = {
            message: routeMessage,
            timestamp: timestamp,
            username: loggedInUser
        };        

        // Remove the temporary routing control and reset the button and message input
        map.removeControl(temporaryRoute);
        temporaryRoute = null;
        routeData = null;  // Clear route data
        confirmRouteButton.disabled = true;

        // Clear the text area after confirming the route
        routeMessageInput.value = '';
    }
}

// Handle clicks on the map to set waypoints for the route
let waypoints = [];
map.on('click', function(e) {
    if (currentMode === 'draw') {
        waypoints.push([e.latlng.lat, e.latlng.lng]);

        if (waypoints.length === 2) {
            addTemporaryRoute(waypoints[0], waypoints[1]);
            waypoints = [];  // Reset waypoints array for the next route
        }
    } else if (currentMode === 'view') {
        let clickedRoute = null;

        permanentRoutes.eachLayer(function(layer) {
            if (layer instanceof L.Polyline) {
                const latLngs = layer.getLatLngs();
                let isOnRoute = false;
        
                // Iterate through each segment of the polyline
                for (let i = 0; i < latLngs.length - 1; i++) {
                    const p1 = latLngs[i];
                    const p2 = latLngs[i + 1];
        
                    // Check if the clicked point is near the segment
                    if (isPointOnSegment(e.latlng, p1, p2, 15)) { // last digit is tolerance
                        clickedRoute = layer;
                        isOnRoute = true;
                        break;
                    }
                }
            }
        });
        

        if (clickedRoute) {
            // Show popup with timestamp and message if available
            const routeDetails = clickedRoute.routeDetails || {};  // Store details in the layer when creating it
            const message = routeDetails.message || '';
            const username = routeDetails.username || '';
            const timestamp = routeDetails.timestamp ? new Date(routeDetails.timestamp).toLocaleString() : 'No timestamp';
            L.popup()
                .setLatLng(e.latlng)
                .setContent(`<strong>Message:</strong> ${message}<br><strong>User:</strong> ${username}<br><strong>Timestamp:</strong> ${timestamp}`)
                .openOn(map);
        }
    }
});

// Helper function to check if a point is on a line segment
function isPointOnSegment(point, segmentStart, segmentEnd, tolerance) {
    // Convert LatLng to Point for distance calculation
    const pointPx = map.latLngToLayerPoint(point);
    const startPx = map.latLngToLayerPoint(segmentStart);
    const endPx = map.latLngToLayerPoint(segmentEnd);

    // Calculate the distance from the point to the segment
    const dist = pointToSegmentDistance(pointPx, startPx, endPx);

    // Return true if the distance is within the tolerance
    return dist <= tolerance;
}

// Helper function to calculate the perpendicular distance between clicked point and line
function pointToSegmentDistance(point, segmentStart, segmentEnd) {
    const x = point.x, y = point.y;
    const x1 = segmentStart.x, y1 = segmentStart.y;
    const x2 = segmentEnd.x, y2 = segmentEnd.y;

    const A = x - x1;
    const B = y - y1;
    const C = x2 - x1;
    const D = y2 - y1;

    const dot = A * C + B * D;
    const lenSq = C * C + D * D;
    const param = lenSq !== 0 ? dot / lenSq : -1;

    let xx, yy;

    if (param < 0) {
        xx = x1;
        yy = y1;
    } else if (param > 1) {
        xx = x2;
        yy = y2;
    } else {
        xx = x1 + param * C;
        yy = y1 + param * D;
    }

    const dx = x - xx;
    const dy = y - yy;

    return Math.sqrt(dx * dx + dy * dy);
}

//Event listener for mode toggle
const modeToggle = document.getElementById('mode-toggle');
modeToggle.addEventListener('change', function() {
    currentMode = modeToggle.value;
});

// Event listener for the confirm button
confirmRouteButton.addEventListener('click', confirmRoute);

// Event listeners for color selection changes
routeColorSelector.addEventListener('change', updateTemporaryRouteStyle);
routeBorderColorSelector.addEventListener('change', updateTemporaryRouteStyle);

// Original colors for reset
const originalColorMap = new Map();


// Handle toggle change
accessibleToggle.addEventListener("change", function () {
    isAccessible = accessibleToggle.checked;
    toggleModalColors(isAccessible);

    permanentRoutes.eachLayer(function (layer) {
        if (layer instanceof L.Polyline) {
            const originalColor = layer.options.color;

            if (isAccessible) {
                // Save original color if not already saved
                if (!originalColorMap.has(layer)) {
                    originalColorMap.set(layer, originalColor);
                }

                // Apply accessible color
                const accessibleColor = accessibleColorMap[originalColor] || originalColor; // Fallback to original if no mapping
                layer.setStyle({ color: accessibleColor });
            } else {
                // Reset to original color
                const resetColor = originalColorMap.get(layer);
                if (resetColor) {
                    layer.setStyle({ color: resetColor });
                }
            }
        }
    });
});

const rgbToNameMap = {
    "rgb(154, 205, 50)": "yellowgreen",
    "rgb(238, 232, 170)": "palegoldenrod",
    "rgb(255, 160, 122)": "lightsalmon",
    "rgb(255, 99, 71)": "tomato",
    "rgb(0, 100, 0)": "darkgreen",
    "rgb(184, 134, 11)": "darkgoldenrod",
    "rgb(139, 0, 0)": "darkred",
    // Add more mappings as needed
};

function rgbToName(rgb) {
    return rgbToNameMap[rgb] || null;
}

function toggleModalColors(isAccessible) {
    const colorElements = document.querySelectorAll("#text-container-modal span");

    colorElements.forEach(el => {
        const currentBgColor = window.getComputedStyle(el).backgroundColor;
        const currentColorName = rgbToName(currentBgColor); 

        if (isAccessible && currentColorName) {
            el.style.backgroundColor = accessibleColorMap[currentColorName];
        } else if (currentColorName) {
            // Reset to original color
            el.style.backgroundColor = currentColorName;
        }
    });
}


window.onload = function() {
    // Fetch existing routes from the backend and add them to the map
    fetch(`${BASE_URL}/routes`)
        .then(response => response.json())
        .then(routes => {
            routes.forEach(route => {
                const coordinates = route.coordinates;
                addClickableRoute(coordinates, route);

                // Create polyline for the border (outline)
                L.polyline(coordinates, {
                    color: route.borderColor,
                    weight: 13,
                    zIndex: 1
                }).addTo(permanentRoutes);

                // Create polyline for the main line
                const routeLine = L.polyline(coordinates, {
                    color: route.color,
                    weight: 5,
                    zIndex: 2
                }).addTo(permanentRoutes);

                // Attach details to each route
                routeLine.routeDetails = {
                    message: route.message,
                    timestamp: route.timestamp,
                    username: route.username
                };
            });
        })
        .catch(error => console.error('Error loading routes:', error));

    // DOM Elements for login/logout functionality
    const loginButton = document.getElementById('login-btn');
    const signUpMainButton = document.getElementById('sign-up-main-btn'); // New Sign-Up Button
    const loginSection = document.getElementById('login-section');
    const loginModal = document.getElementById('login-modal');
    const closeModal = document.querySelector('.close');
    const loginForm = document.getElementById('login-form');
    const toggleSignUpButton = document.getElementById('toggle-sign-up-btn');
    const emailField = document.getElementById('email-field'); // New Email Field
    const modalTitle = document.getElementById('modal-title'); // Modal title
    const submitButton = document.getElementById('submit-btn'); // Submit button
    const toggleFormText = document.getElementById('toggle-form-text');
    const logoutButton = document.getElementById('logout-btn');
    const userControls = document.getElementById('user-controls');
    const loginInfoButton = document.getElementById('login-info');
    const optionsButton = document.getElementById('options');
    const editInfoButton = document.getElementById('edit-info');
    const textContainerModal = document.getElementById('text-container-modal');
    const optionsContainerModal = document.getElementById('options-container-modal');
    const closeInfoModalButton = document.getElementById('close-info-modal');
    const closeOptionsButton = document.getElementById('close-options-modal');


    // Initially, the email field is hidden (only shown in sign-up mode)
    emailField.style.display = 'none';
    userControls.style.display = 'none';
    logoutButton.style.display = 'none';
    textContainerModal.style.display = 'none';
    optionsContainerModal.style.display = 'none';
    
    loginInfoButton.addEventListener('click', function() {
        textContainerModal.style.display = 'block';
    });

    optionsButton.addEventListener('click', function() {
        optionsContainerModal.style.display = 'block';
    });
    
    editInfoButton.addEventListener('click', function() {
        textContainerModal.style.display = 'block';
    });
    
    closeInfoModalButton.addEventListener('click', function() {
        textContainerModal.style.display = 'none';
    });

    closeOptionsButton.addEventListener('click', function() {
        optionsContainerModal.style.display = 'none';
    });
    
    // Close modal when clicking outside the modal content
    window.addEventListener('click', function(event) {
        if (event.target === textContainerModal) {
            textContainerModal.style.display = 'none';
        }

        if (event.target === optionsContainerModal) {
            optionsContainerModal.style.display = 'none';
        }
    });
    

    // Show the login modal when clicking the login button
    loginButton.addEventListener('click', function() {
        modalTitle.textContent = 'login'; // Set the title to "Login"
        submitButton.textContent = 'login'; // Set the button text to "Login"
        emailField.style.display = 'none'; // Hide the email field in login mode
        toggleFormText.innerHTML = 'don\'t have an account? <button id="toggle-sign-up-btn">sign up</button>';
        loginModal.style.display = 'block'; // Show the modal
    });

    // Show the sign-up modal when clicking the sign-up button
    signUpMainButton.addEventListener('click', function() {
        modalTitle.textContent = 'sign up'; // Set the title to "Sign Up"
        submitButton.textContent = 'sign up'; // Set the button text to "Sign Up"
        emailField.style.display = 'block'; // Show the email field in sign-up mode
        toggleFormText.innerHTML = 'already have an account? <button id="toggle-sign-up-btn">login</button>';
        loginModal.style.display = 'block'; // Show the modal
    });

    // Close modal event
    closeModal.addEventListener('click', function() {
        loginModal.style.display = 'none';
    });

    // Close modal when clicking outside the modal content
    window.addEventListener('click', function(event) {
        if (event.target == loginModal) {
            loginModal.style.display = 'none';
        }
    });

    // Toggle between login and sign-up forms
    document.addEventListener('click', function(event) {
        if (event.target && event.target.id === 'toggle-sign-up-btn') {
            if (submitButton.textContent === 'login') {
                modalTitle.textContent = 'sign up'; // Change to sign-up
                submitButton.textContent = 'sign up'; // Change button text
                emailField.style.display = 'block'; // Show email field
                toggleFormText.innerHTML = 'already have an account? <button id="toggle-sign-up-btn">login</button>';
            } else {
                modalTitle.textContent = 'login'; // Change to login
                submitButton.textContent = 'login'; // Change button text
                emailField.style.display = 'none'; // Hide email field
                toggleFormText.innerHTML = 'don\'t have an account? <button id="toggle-sign-up-btn">sign up</button>';
            }
        }
    });

    // Handle form submission for both login and sign-up
    loginForm.addEventListener('submit', function(event) {
        event.preventDefault();
    
        const username = document.getElementById('username').value;
        const password = document.getElementById('password').value;
        const email = document.getElementById('email').value; // Optional email field
    
        if (submitButton.textContent === 'login') {
            // Login logic
            if (username && password) {
                // Data being sent to the server
                const loginData = {
                    username: username,
                    password: password
                };
        
                // Send API request to login
                fetch(`${BASE_URL}/login`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(loginData)
                })
                .then(response => {
                    if (!response.ok) {
                        throw new Error('Network response was not ok: ' + response.statusText);
                    }
                    return response.json();
                })
                .then(data => {
                    if (data.error) {
                        alert(data.error);
                    } else {
                        // Successful login logic
                        loggedInUser = username;
                        loginModal.style.display = 'none';
                        loginButton.style.display = 'none';
                        signUpMainButton.style.display = 'none';
                        loginSection.style.display = 'none';
                        logoutButton.style.display = 'block'; 
                        userControls.style.display = 'block';
        
                        document.getElementById('logged-in-user').textContent = loggedInUser;
                    }
                })
                .catch(error => {
                    console.error('Error during login:', error);
                    alert('An error occurred during login. Please try again.');
                });
            } else {
                alert('Please enter both username and password.');
            }
        }
         else {
            // Sign-up logic
            if (username && password && email) {
                const userData = {
                    email: email,
                    username: username,
                    password: password
                };
    
                fetch(`${BASE_URL}/signup`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(userData)
                })
                .then(response => response.json())
                .then(data => {
                    if (data.error) {
                        alert(data.error);
                    } else {
                        // Successful signup logic
                        loginModal.style.display = 'none';
                        loginSection.style.display = 'block'; // Show login button again
                        loginButton.style.display = 'block'; // Show login button again
                        signUpMainButton.style.display = 'none';

                        logoutButton.style.display = 'none'; 
                        userControls.style.display = 'none';
                    }
                })
                .catch(error => console.error('Error during signup:', error));
            } else {
                alert('Please fill in all fields (username, password, and email).');
            }
        }
    });
    

    logoutButton.addEventListener('click', function() {
        // Hide user controls and show the login button
        userControls.style.display = 'none'; // Hide controls
        logoutButton.style.display = 'none'; // Hide logout button
        loginSection.style.display = 'block'; // Show login button again
        loginInfoButton.style.display = 'block'; // Show login button again
        optionsButton.style.display = 'block'; // Show login button again
        loginButton.style.display = 'block'; // Show login button again

        document.getElementById('logged-in-user').textContent = 'guest';
    });

};

// Minimize button functionality
$(document).ready(function() {
    $('#toggle-button').click(function() {
        if ($('#text-container').is(':visible')) {
            $('#text-container').slideUp('fast');
            $(this).text('+');
        } else {
            $('#text-container').slideDown('fast');
            $(this).text('-');
        }
    });
});