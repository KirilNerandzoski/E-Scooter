# Stage 1: Build React frontend
FROM node:22-alpine AS frontend-build
WORKDIR /frontend
COPY frontend/package.json frontend/package-lock.json ./
RUN npm install --no-audit --no-fund
COPY frontend/ ./
RUN npm run build

# Stage 2: Build .NET 10 backend
FROM mcr.microsoft.com/dotnet/sdk:10.0 AS backend-build
WORKDIR /src
COPY backend/Rydio.Api/Rydio.Api.csproj backend/Rydio.Api/
RUN dotnet restore backend/Rydio.Api/Rydio.Api.csproj
COPY backend/Rydio.Api/ backend/Rydio.Api/
RUN dotnet publish backend/Rydio.Api/Rydio.Api.csproj -c Release -o /app/publish /p:UseAppHost=false

# Stage 3: Single ASP.NET Core 10 runtime serving API + React SPA from wwwroot
FROM mcr.microsoft.com/dotnet/aspnet:10.0 AS runtime
WORKDIR /app
COPY --from=backend-build /app/publish .
COPY --from=frontend-build /frontend/dist ./wwwroot
ENV ASPNETCORE_ENVIRONMENT=Production
EXPOSE 8080
ENTRYPOINT ["dotnet", "Rydio.Api.dll"]
