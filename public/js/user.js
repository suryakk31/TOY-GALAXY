   // User icon click handler
   document.getElementById('user-icon').addEventListener('click', function(event) {
    <% if (isLoggedIn) { %>
      event.preventDefault();
      var userInfo = document.getElementById('user-info');
      if (userInfo.style.display === 'none' || userInfo.style.display === '') {
        userInfo.style.display = 'block';
      } else {
        userInfo.style.display = 'none';
      }
    <% } %>
  });

  // Logout button confirmation
  document.getElementById('logout-button').addEventListener('click', function(event) {
    event.preventDefault();
    Swal.fire({
      title: 'Are you sure you want to logout?',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Yes, logout',
      cancelButtonText: 'Cancel'
    }).then((result) => {
      if (result.isConfirmed) {
        window.location.href = '/auth/logout';
      }
    });
  });