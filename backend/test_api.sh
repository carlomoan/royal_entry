#!/bin/bash
TOKEN="eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJzdWIiOiI0ZDE4ZTYwNS1mY2ZlLTQyMWUtODNjNy1mZmVmZDBkYzVlY2UiLCJvcmdfaWQiOiIwMDAwMDAwMC0wMDAwLTAwMDAtMDAwMC0wMDAwMDAwMDAwMDAiLCJlbWFpbCI6ImFkbWluQGZvY3Rlay5jby50eiIsInJvbGUiOiJzdXBlcmFkbWluIiwiZXhwIjoxNzg1ODUxODY5LCJpYXQiOjE3ODU3NjU0NjksInRva2VuX3R5cGUiOiJhY2Nlc3MiLCJpbXBlcnNvbmF0ZWRfYnkiOm51bGwsImltcGVyc29uYXRlZF9hdCI6bnVsbH0.ZK5XDaepwoinHe2eU4V4dXF1VOkOAht1ZA_0hId0e6E"
echo "=== Test GET plans ==="
curl -s -X GET http://127.0.0.1:3000/api/v1/platform/plans -H "Authorization: Bearer $TOKEN"
echo ""
echo "=== Test GET customers ==="
curl -s -X GET http://127.0.0.1:3000/api/v1/platform/customers -H "Authorization: Bearer $TOKEN"
echo ""
echo "=== Test POST create org ==="
curl -s -X POST http://127.0.0.1:3000/api/v1/platform/organizations -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" -d '{"display_name":"Test Org","admin":{"email":"test@test.com","password":"Test12345","full_name":"Test User"}}'
echo ""
echo "=== Test POST impersonate ==="
curl -s -X POST http://127.0.0.1:3000/api/v1/platform/organizations/00000000-0000-0000-0000-000000000000/impersonate -H "Authorization: Bearer $TOKEN"
echo ""