let selectedImages = [];
let restaurantName = '';
let restCoordinates = '';

// Add event listener to each image
document.querySelectorAll('#image-gallery img').forEach(img => {
    img.addEventListener('click', function () {
        toggleImageSelection(this); // Pass the clicked image
    });
});

// Toggle image selection
function toggleImageSelection(imgElement) {
    const imageUrl = imgElement.getAttribute('data-url');

    restaurantName = imgElement.getAttribute('data-restaurant-name');
    restCoordinates = imgElement.getAttribute('data-rest-coordinates');

    if (selectedImages.includes(imageUrl)) {
        // Deselect the image
        selectedImages = selectedImages.filter(img => img !== imageUrl); 
        imgElement.classList.remove('selected');
        imgElement.parentElement.classList.remove('selected'); // Remove overlay from label
    } else {
        // Select the image
        selectedImages.push(imageUrl); 
        imgElement.classList.add('selected');
        imgElement.parentElement.classList.add('selected'); // Add overlay to label
    }
    
    console.log('Selected images:', selectedImages);
}

// Handle save and next button click
document.getElementById('save-btn').addEventListener('click', function () {
    saveSelection(restaurantName, restCoordinates, selectedImages);
});

// Save selection and proceed to the next restaurant
function saveSelection(restaurantName, restCoordinates, selectedImages) {
    console.log('Saving selected images:', selectedImages);

    fetch('/select_image', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            rest_name: restaurantName,
            rest_coordinates: restCoordinates,
            selected_images: selectedImages,
        }),
    })
    .then(response => response.json())
    .then(data => {
        window.location.reload(); // Reload page to show next restaurant
    })
    .catch(error => {
        console.error('Error:', error);
    });
}
