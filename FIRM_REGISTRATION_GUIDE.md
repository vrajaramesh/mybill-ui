# Firm Registration Feature Implementation Guide

## Frontend Components Created

### 1. **FirmService** (`firm.service.ts`)
- Handles API calls for firm registration and retrieval
- Methods:
  - `registerFirm(data: FirmRegistration)`: Register a new firm
  - `listFirms()`: Get list of all firms

### 2. **RegisterFirmComponent** (`register-firm/`)
- Standalone Angular component for firm registration
- Features:
  - Form validation
  - Auto-generate firm code from firm name
  - Password visibility toggle
  - Success/error messaging
  - Responsive design

### 3. **Integration Points**
- Updated `AppComponent` to handle navigation between login and register views
- Updated `LoginComponent` with "Create a New Firm" button
- Added `currentView` state management ('login' | 'register' | 'app')

## Backend API Endpoints Required

### 1. **Firm Registration Endpoint**
```
POST /api/firms/register
Content-Type: application/json

Request Body:
{
  "firmName": "string",          // Required: Name of the firm
  "firmCode": "string",          // Required: Unique identifier (lowercase, alphanumeric + _ -)
  "ownerEmail": "string",        // Required: Owner's email address
  "adminUsername": "string",     // Required: Admin username (min 3 chars)
  "adminPassword": "string",     // Required: Admin password (min 6 chars)
  "adminFullName": "string"      // Required: Admin's full name
}

Response (200 OK):
{
  "firmId": number,
  "firmName": "string",
  "firmCode": "string",
  "message": "Firm registered successfully"
}

Error Response (400/409):
{
  "error": "string",             // Error message
  "message": "string"            // Additional details
}
```

### 2. **List Firms Endpoint** (Optional)
```
GET /api/firms
Authorization: Bearer <JWT_TOKEN>

Response (200 OK):
[
  {
    "firmId": number,
    "firmName": "string",
    "firmCode": "string",
    "schemaName": "string",
    "ownerEmail": "string",
    "isActive": boolean,
    "createdAt": "ISO-8601 datetime"
  }
]
```

## Backend Implementation Checklist

### Database Changes
- [ ] Create `firms` table with fields:
  - `firm_id` (PK, auto-increment)
  - `firm_name` (unique, not null)
  - `firm_code` (unique, not null)
  - `schema_name` (unique, not null)
  - `owner_email` (not null)
  - `is_active` (boolean, default true)
  - `created_at` (timestamp, default now)
  - `updated_at` (timestamp)

- [ ] Ensure users table has `firm_id` foreign key

### Spring Boot Implementation

#### 1. FirmDTO Classes
```java
@Data
public class FirmRegistrationRequest {
    private String firmName;
    private String firmCode;
    private String ownerEmail;
    private String adminUsername;
    private String adminPassword;
    private String adminFullName;
}

@Data
public class FirmResponse {
    private Long firmId;
    private String firmName;
    private String firmCode;
    private String message;
}
```

#### 2. Firm Entity
```java
@Entity
@Table(name = "firms")
@Data
public class Firm {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long firmId;
    
    @Column(unique = true, nullable = false)
    private String firmName;
    
    @Column(unique = true, nullable = false)
    private String firmCode;
    
    @Column(unique = true, nullable = false)
    private String schemaName;
    
    @Column(nullable = false)
    private String ownerEmail;
    
    @Column(name = "is_active")
    private Boolean isActive = true;
    
    @CreationTimestamp
    private LocalDateTime createdAt;
    
    @UpdateTimestamp
    private LocalDateTime updatedAt;
}
```

#### 3. FirmController
```java
@RestController
@RequestMapping("/api/firms")
@CrossOrigin(origins = "${app.cors.allowed-origins}")
public class FirmController {
    
    @PostMapping("/register")
    public ResponseEntity<?> registerFirm(@RequestBody FirmRegistrationRequest request) {
        // Validation
        // Create firm
        // Create tenant schema (PostgreSQL)
        // Create default admin user
        // Return FirmResponse
    }
    
    @GetMapping
    @PreAuthorize("hasRole('SUPER_ADMIN')")
    public ResponseEntity<List<FirmDTO>> listFirms() {
        // Return list of firms
    }
}
```

#### 4. FirmService
```java
@Service
public class FirmService {
    
    public Firm registerFirm(FirmRegistrationRequest request) {
        // Validate firm code uniqueness
        // Create firm entity
        // Create PostgreSQL schema
        // Create admin user
        // Initialize default data
        return firm;
    }
    
    private void createTenantSchema(String schemaName) {
        // Create schema using JdbcTemplate
        // Run migration scripts
    }
    
    private void createAdminUser(Firm firm, String username, String password, String fullName) {
        // Create user with ADMIN role
        // Set firm_id for the user
    }
}
```

## Frontend Feature Validation

✅ **Form Validation:**
- Firm name: Required, non-empty
- Firm code: Required, alphanumeric with - and _
- Owner email: Required, valid email format
- Admin username: Required, minimum 3 characters
- Admin password: Required, minimum 6 characters
- Confirm password: Must match password
- Admin full name: Required, non-empty

✅ **User Experience:**
- Auto-generates firm code from firm name
- Password visibility toggle
- Shows loading state during submission
- Displays success message after registration
- Returns to login page after 2 seconds
- Can go back to login at any time

## Testing Endpoints

### Register a Firm
```bash
curl -X POST http://localhost:8080/api/firms/register \
  -H "Content-Type: application/json" \
  -d '{
    "firmName": "Test Fabrics",
    "firmCode": "test_fabrics",
    "ownerEmail": "owner@test.com",
    "adminUsername": "admin",
    "adminPassword": "Admin@123",
    "adminFullName": "Admin User"
  }'
```

### List Firms
```bash
curl -X GET http://localhost:8080/api/firms \
  -H "Authorization: Bearer <JWT_TOKEN>"
```

## Security Considerations

1. ✅ Password validation (minimum length)
2. ✅ Email format validation
3. ✅ Firm code format validation
4. ✅ CORS configuration
5. ⚠️ Rate limiting for registration (recommended)
6. ⚠️ Email verification (recommended)
7. ⚠️ Honeypot field to prevent spam (recommended)
8. ⚠️ Password strength requirements (recommended)

## Next Steps

1. Create Firm entity and repository
2. Implement FirmService with tenant schema creation
3. Create FirmController with registration endpoint
4. Run database migration for firms table
5. Test registration flow end-to-end
6. Add email verification (optional)
7. Add firm approval workflow (optional)

