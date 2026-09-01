## ⚙️ .NET & Windows Process Hygiene

### 1. Build Server Lifecycle Management
- Every command or script that invokes `dotnet build`, `dotnet publish`, `msbuild`, or compiler workers must immediately terminate lingering worker nodes.
- Run `dotnet build-server shutdown` after build operations to prevent background CPU/memory leaks and file locks.
- Verify `Directory.Build.props` includes `<NodeReuse>false</NodeReuse>`.

### 2. Native Win32 / WinUI Invariants
- Thread safety: UI mutations must be dispatched via `DispatcherQueue.TryEnqueue`.
- Payload safety: Verify running processes are terminated before modifying or extracting runtime binaries in `%LOCALAPPDATA%`.
- Offline by design: Never introduce telemetry, remote crash loggers, or tracking SDKs into core runtime assemblies.
