To Mind Matters — auth testing playbook
See /app/memory/test_credentials.md for the active user.

Quick curl:
curl -X POST $URL/api/auth/signup -H "Content-Type: application/json" -d '{"first_name":"Karan","email":"karan@mm.local","password":"changeme123"}'
curl -X POST $URL/api/auth/login -H "Content-Type: application/json" -d '{"email":"karan@mm.local","password":"changeme123"}'
