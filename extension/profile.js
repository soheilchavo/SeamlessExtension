// Profile page JavaScript

console.log('Profile page loaded');

// ===== PROFILE DATA (localStorage) =====
function getProfile() {
    try {
        const profile = localStorage.getItem('userProfile');
        return profile ? JSON.parse(profile) : {};
    } catch (error) {
        console.error('Error loading profile:', error);
        return {};
    }
}

function saveProfile(profileData) {
    try {
        localStorage.setItem('userProfile', JSON.stringify(profileData));
        console.log('Profile saved:', profileData);
        return true;
    } catch (error) {
        console.error('Error saving profile:', error);
        return false;
    }
}

// Navigation handler
document.addEventListener('DOMContentLoaded', () => {
    // Load saved profile data
    const profile = getProfile();

    // Populate form fields with saved data
    if (profile.gender) {
        document.getElementById('gender').value = profile.gender;
    }
    if (profile.shirtSize) {
        document.getElementById('shirt-size').value = profile.shirtSize;
    }
    if (profile.pantsSize) {
        document.getElementById('pants-size').value = profile.pantsSize;
    }
    if (profile.shoeSize) {
        document.getElementById('shoe-size').value = profile.shoeSize;
    }

    // Handle form submission
    const profileForm = document.getElementById('profile-form');
    const saveMessage = document.getElementById('profile-save-message');

    profileForm.addEventListener('submit', (e) => {
        e.preventDefault();

        const formData = new FormData(profileForm);
        const profileData = {
            gender: formData.get('gender'),
            shirtSize: formData.get('shirtSize'),
            pantsSize: formData.get('pantsSize'),
            shoeSize: formData.get('shoeSize')
        };

        if (saveProfile(profileData)) {
            // Show success message
            saveMessage.style.display = 'block';
            setTimeout(() => {
                saveMessage.style.display = 'none';
            }, 3000);
        }
    });

    // Handle navigation
    const navItems = document.querySelectorAll('.nav-item');
    navItems.forEach(navItem => {
        navItem.addEventListener('click', () => {
            const targetPage = navItem.getAttribute('data-page');
            if (targetPage) {
                window.location.href = targetPage;
            }
        });
    });
});
