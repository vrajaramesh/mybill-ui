import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { UserService, User } from '../user.service';
import { AuthService } from '../auth.service';

interface UserForm {
  username: string;
  password: string;
  fullName: string;
  email: string;
  phone: string;
  role: 'ADMIN' | 'SALES';
  isActive: boolean;
}

@Component({
  selector: 'app-user-management',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './user-management.component.html',
  styleUrls: ['./user-management.component.css']
})
export class UserManagementComponent implements OnInit {
  users: User[] = [];
  loading = false;
  error = '';
  successMsg = '';

  showModal = false;
  modalMode: 'create' | 'edit' = 'create';
  editingUserId: number | null = null;

  form: UserForm = this.emptyForm();
  formError = '';
  formLoading = false;

  deleteConfirmId: number | null = null;
  deleteConfirmName = '';

  showPasswordModal = false;
  pwForm = { newPassword: '', confirmPassword: '' };
  pwUserId: number | null = null;
  pwUserName = '';
  pwError = '';
  pwLoading = false;

  constructor(private userService: UserService, public authService: AuthService) {}

  ngOnInit(): void {
    this.loadUsers();
  }

  private emptyForm(): UserForm {
    return { username: '', password: '', fullName: '', email: '', phone: '', role: 'SALES', isActive: true };
  }

  loadUsers(): void {
    this.loading = true;
    this.error = '';
    this.userService.getUsers().subscribe({
      next: users => { this.users = users; this.loading = false; },
      error: () => { this.error = 'Failed to load users'; this.loading = false; }
    });
  }

  get currentUserId(): number | null {
    return this.authService.getCurrentUser()?.userId ?? null;
  }

  isSelf(userId: number): boolean {
    return this.currentUserId === userId;
  }

  get totalUsers(): number { return this.users.length; }
  get activeCount(): number { return this.users.filter(u => u.isActive).length; }
  get adminCount(): number { return this.users.filter(u => u.role === 'ADMIN').length; }
  get salesCount(): number { return this.users.filter(u => u.role === 'SALES').length; }

  initials(name: string): string {
    if (!name) return '?';
    return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
  }

  openCreateModal(): void {
    this.form = this.emptyForm();
    this.formError = '';
    this.modalMode = 'create';
    this.editingUserId = null;
    this.showModal = true;
  }

  openEditModal(user: User): void {
    this.form = {
      username: user.username,
      password: '',
      fullName: user.fullName || '',
      email: user.email || '',
      phone: user.phone || '',
      role: user.role,
      isActive: user.isActive
    };
    this.formError = '';
    this.modalMode = 'edit';
    this.editingUserId = user.userId;
    this.showModal = true;
  }

  closeModal(): void {
    this.showModal = false;
  }

  saveUser(): void {
    this.formError = '';
    if (!this.form.fullName.trim()) { this.formError = 'Full name is required'; return; }

    if (this.modalMode === 'create') {
      if (!this.form.username.trim()) { this.formError = 'Username is required'; return; }
      if (!this.form.password) { this.formError = 'Password is required'; return; }
      if (this.form.password.length < 6) { this.formError = 'Password must be at least 6 characters'; return; }
    } else if (this.form.password && this.form.password.length < 6) {
      this.formError = 'Password must be at least 6 characters';
      return;
    }

    this.formLoading = true;

    if (this.modalMode === 'create') {
      this.userService.createUser({
        username: this.form.username.trim(),
        password: this.form.password,
        fullName: this.form.fullName.trim(),
        email: this.form.email || undefined,
        phone: this.form.phone || undefined,
        role: this.form.role,
        isActive: true
      }).subscribe({
        next: () => { this.formLoading = false; this.closeModal(); this.showSuccess('User created successfully'); this.loadUsers(); },
        error: err => { this.formLoading = false; this.formError = typeof err.error === 'string' ? err.error : 'Error creating user'; }
      });
    } else {
      const payload: any = {
        fullName: this.form.fullName.trim(),
        email: this.form.email || null,
        phone: this.form.phone || null,
        role: this.form.role,
        isActive: this.form.isActive
      };
      if (this.form.password) payload.password = this.form.password;

      this.userService.updateUser(this.editingUserId!, payload).subscribe({
        next: () => { this.formLoading = false; this.closeModal(); this.showSuccess('User updated successfully'); this.loadUsers(); },
        error: () => { this.formLoading = false; this.formError = 'Error updating user'; }
      });
    }
  }

  confirmDelete(user: User): void {
    this.deleteConfirmId = user.userId;
    this.deleteConfirmName = user.fullName || user.username;
  }

  cancelDelete(): void {
    this.deleteConfirmId = null;
  }

  doDelete(): void {
    if (!this.deleteConfirmId) return;
    const id = this.deleteConfirmId;
    this.deleteConfirmId = null;
    this.userService.deleteUser(id).subscribe({
      next: () => { this.showSuccess('User deleted'); this.loadUsers(); },
      error: () => { this.error = 'Failed to delete user'; }
    });
  }

  toggleStatus(user: User): void {
    this.userService.updateUser(user.userId, {
      fullName: user.fullName,
      email: user.email,
      phone: user.phone,
      role: user.role,
      isActive: !user.isActive
    }).subscribe({
      next: () => this.loadUsers(),
      error: () => { this.error = 'Failed to update status'; }
    });
  }

  openPasswordModal(user: User): void {
    this.pwForm = { newPassword: '', confirmPassword: '' };
    this.pwError = '';
    this.pwUserId = user.userId;
    this.pwUserName = user.fullName || user.username;
    this.showPasswordModal = true;
  }

  closePasswordModal(): void {
    this.showPasswordModal = false;
  }

  savePassword(): void {
    this.pwError = '';
    if (!this.pwForm.newPassword) { this.pwError = 'New password is required'; return; }
    if (this.pwForm.newPassword.length < 6) { this.pwError = 'Password must be at least 6 characters'; return; }
    if (this.pwForm.newPassword !== this.pwForm.confirmPassword) { this.pwError = 'Passwords do not match'; return; }

    const user = this.users.find(u => u.userId === this.pwUserId);
    if (!user) { this.closePasswordModal(); return; }

    this.pwLoading = true;
    this.userService.updateUser(this.pwUserId!, {
      fullName: user.fullName,
      email: user.email,
      phone: user.phone,
      role: user.role,
      isActive: user.isActive,
      password: this.pwForm.newPassword
    }).subscribe({
      next: () => { this.pwLoading = false; this.closePasswordModal(); this.showSuccess('Password updated successfully'); },
      error: () => { this.pwLoading = false; this.pwError = 'Failed to update password'; }
    });
  }

  get saveButtonLabel(): string {
    if (this.formLoading) return 'Saving...';
    return this.modalMode === 'create' ? 'Create User' : 'Save Changes';
  }

  private showSuccess(msg: string): void {
    this.successMsg = msg;
    setTimeout(() => { this.successMsg = ''; }, 3000);
  }
}
