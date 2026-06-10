"""
Authentication routes
"""
from flask import current_app, flash, redirect, render_template, request, session, url_for
from routes import auth_bp

@auth_bp.route('/login', methods=['GET', 'POST'])
@auth_bp.route('/', methods=['GET', 'POST'])
def login():
    """Handle user login"""
    if request.method == 'POST':
        username = request.form.get('username', '').strip()
        password = request.form.get('password', '')

        login_mail = current_app.config.get('LOGIN_MAIL')
        login_password = current_app.config.get('LOGIN_PASSWORD')

        if username == login_mail and password == login_password:
            session['logged_in'] = True
            session['username'] = username
            return redirect(url_for('web.home'))

        flash('Invalid username or password. Please try again.', 'error')
        return redirect(url_for('auth.login'))

    return render_template('login.html')

@auth_bp.route('/logout')
def logout():
    """Handle user logout"""
    session.pop('logged_in', None)
    session.pop('username', None)
    flash('You have been logged out successfully.', 'info')
    return redirect(url_for('auth.login'))
