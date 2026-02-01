# ADR-001: Electron Desktop Platform

## Status
**Accepted**

## Context

We need to build a Cosmos DB viewer application. The key constraints are:

1. **Cosmos SDK Requirements**: The @azure/cosmos SDK is designed primarily for Node.js and has limitations in browser environments
2. **Security**: Connection strings contain sensitive keys that shouldn't be exposed in browser storage
3. **CORS**: Browser-based apps require Cosmos DB CORS configuration, which users may not have control over
4. **User Experience**: Database tools like DataGrip and DBeaver are desktop applications

### Options Considered

1. **Browser-only SPA** (Angular deployed as web app)
2. **Angular + Backend API** (Angular frontend with Express/NestJS backend)
3. **Electron Desktop App** (Angular in Electron shell)
4. **Tauri Desktop App** (Angular with Rust backend)

## Decision

We will use **Electron** as our desktop platform with Angular running in the renderer process.

## Rationale

### Why Electron?

| Criterion | Browser SPA | Backend API | Electron | Tauri |
|-----------|-------------|-------------|----------|-------|
| Cosmos SDK access | Limited | Full | Full | Would need Rust bindings |
| Secure credentials | Poor | Good | Excellent | Excellent |
| No CORS issues | No | Yes | Yes | Yes |
| Development speed | Fast | Medium | Fast | Slower |
| Bundle size | N/A | N/A | Large | Small |
| Familiar tooling | Yes | Yes | Yes | Less |

### Key Advantages

1. **Full Node.js Access**: Main process can use @azure/cosmos SDK directly without limitations
2. **electron-store**: Encrypted local storage for connection credentials
3. **No Server Required**: Users don't need to deploy/maintain a backend
4. **Cross-Platform**: Single codebase for Windows, macOS, Linux
5. **Familiar Development**: Same Angular/TypeScript tooling
6. **IPC Pattern**: Clean separation between UI and business logic

### Trade-offs Accepted

1. **Bundle Size**: Electron apps are larger (~150MB) - acceptable for a database tool
2. **Memory Usage**: Chromium runtime uses more memory - acceptable for developer tooling
3. **Updates**: Need to handle app updates - can use electron-updater

## Implementation

### Architecture

```
┌─────────────────────────────────────────┐
│           Main Process (Node.js)         │
│  ┌─────────────┐  ┌─────────────────┐   │
│  │@azure/cosmos│  │ electron-store  │   │
│  └─────────────┘  └─────────────────┘   │
└─────────────────────────────────────────┘
              │ IPC
┌─────────────────────────────────────────┐
│        Renderer Process (Angular)        │
│           (Sandboxed browser)            │
└─────────────────────────────────────────┘
```

### Key Dependencies

```json
{
  "electron": "^33.x",
  "electron-store": "^10.x",
  "@azure/cosmos": "^4.x"
}
```

### Security Measures

1. **Context Isolation**: Renderer has no direct Node.js access
2. **Preload Script**: Only whitelisted APIs exposed via contextBridge
3. **Encrypted Storage**: electron-store encrypts credentials at rest

## Consequences

### Positive
- Users get a native-feeling application
- No server infrastructure to maintain
- Secure credential storage out of the box
- Full Cosmos SDK feature support

### Negative
- Larger download size than web app
- Users must install the application
- Need to handle updates and distribution

### Neutral
- Requires learning Electron IPC patterns
- Build process slightly more complex

## References

- [Electron Documentation](https://www.electronjs.org/docs)
- [electron-store](https://github.com/sindresorhus/electron-store)
- [@azure/cosmos SDK](https://docs.microsoft.com/en-us/javascript/api/@azure/cosmos/)
