FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build
WORKDIR /src
COPY Rydio.Api/Rydio.Api.csproj Rydio.Api/
RUN dotnet restore Rydio.Api/Rydio.Api.csproj
COPY Rydio.Api/ Rydio.Api/
RUN dotnet publish Rydio.Api/Rydio.Api.csproj -c Release -o /app/publish /p:UseAppHost=false

FROM mcr.microsoft.com/dotnet/aspnet:10.0 AS runtime
WORKDIR /app
COPY --from=build /app/publish .
ENV ASPNETCORE_ENVIRONMENT=Production
EXPOSE 8080
ENTRYPOINT ["dotnet", "Rydio.Api.dll"]
