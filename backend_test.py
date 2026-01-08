#!/usr/bin/env python3
"""
PyPlanPoker Backend API Testing
Tests all REST API endpoints for the Planning Poker application
"""

import requests
import sys
import json
from datetime import datetime
from typing import Dict, Any, Optional

class PyPlanPokerAPITester:
    def __init__(self, base_url="https://pyplanpoker.preview.emergentagent.com/api"):
        self.base_url = base_url
        self.tests_run = 0
        self.tests_passed = 0
        self.test_data = {}
        
    def log(self, message: str):
        """Log test messages"""
        print(f"[{datetime.now().strftime('%H:%M:%S')}] {message}")
        
    def run_test(self, name: str, method: str, endpoint: str, expected_status: int, 
                 data: Optional[Dict] = None, headers: Optional[Dict] = None) -> tuple[bool, Dict]:
        """Run a single API test"""
        url = f"{self.base_url}/{endpoint.lstrip('/')}"
        
        if headers is None:
            headers = {'Content-Type': 'application/json'}
            
        self.tests_run += 1
        self.log(f"🔍 Testing {name}...")
        self.log(f"   {method} {url}")
        
        try:
            if method == 'GET':
                response = requests.get(url, headers=headers, timeout=10)
            elif method == 'POST':
                response = requests.post(url, json=data, headers=headers, timeout=10)
            elif method == 'PUT':
                response = requests.put(url, json=data, headers=headers, timeout=10)
            elif method == 'DELETE':
                response = requests.delete(url, headers=headers, timeout=10)
            else:
                raise ValueError(f"Unsupported method: {method}")
                
            success = response.status_code == expected_status
            
            if success:
                self.tests_passed += 1
                self.log(f"✅ PASSED - Status: {response.status_code}")
                try:
                    response_data = response.json()
                    return True, response_data
                except:
                    return True, {}
            else:
                self.log(f"❌ FAILED - Expected {expected_status}, got {response.status_code}")
                try:
                    error_data = response.json()
                    self.log(f"   Error: {error_data}")
                except:
                    self.log(f"   Response: {response.text}")
                return False, {}
                
        except requests.exceptions.RequestException as e:
            self.log(f"❌ FAILED - Network Error: {str(e)}")
            return False, {}
        except Exception as e:
            self.log(f"❌ FAILED - Error: {str(e)}")
            return False, {}
    
    def test_root_endpoint(self):
        """Test the root API endpoint"""
        success, data = self.run_test(
            "Root API Endpoint",
            "GET", 
            "/",
            200
        )
        return success
    
    def test_fibonacci_endpoint(self):
        """Test the Fibonacci values endpoint"""
        success, data = self.run_test(
            "Fibonacci Values",
            "GET",
            "/fibonacci", 
            200
        )
        if success and 'values' in data:
            expected_values = [0, 1, 2, 3, 5, 8, 13, 21, 34, 55, 89, "?"]
            if data['values'] == expected_values:
                self.log("   ✅ Fibonacci values are correct")
            else:
                self.log(f"   ⚠️  Fibonacci values mismatch: {data['values']}")
        return success
    
    def test_create_room(self):
        """Test room creation"""
        room_data = {
            "name": f"Test Room {datetime.now().strftime('%H%M%S')}"
        }
        
        success, data = self.run_test(
            "Create Room",
            "POST",
            "/rooms",
            200,
            data=room_data
        )
        
        if success and data:
            self.test_data['room'] = data
            self.log(f"   Room created with ID: {data.get('id')}")
            
            # Validate room structure
            required_fields = ['id', 'name', 'created_at', 'cards_revealed']
            for field in required_fields:
                if field not in data:
                    self.log(f"   ⚠️  Missing field: {field}")
                    
        return success
    
    def test_get_room(self):
        """Test getting room details"""
        if 'room' not in self.test_data:
            self.log("❌ Skipping - No room created")
            return False
            
        room_id = self.test_data['room']['id']
        success, data = self.run_test(
            "Get Room Details",
            "GET",
            f"/rooms/{room_id}",
            200
        )
        
        if success and data:
            self.log(f"   Retrieved room: {data.get('name')}")
            
        return success
    
    def test_get_nonexistent_room(self):
        """Test getting a non-existent room"""
        success, data = self.run_test(
            "Get Non-existent Room",
            "GET",
            "/rooms/INVALID123",
            404
        )
        return success
    
    def test_join_room_as_admin(self):
        """Test joining room as first user (admin)"""
        if 'room' not in self.test_data:
            self.log("❌ Skipping - No room created")
            return False
            
        room_id = self.test_data['room']['id']
        join_data = {
            "room_id": room_id,
            "name": "Test Admin",
            "is_spectator": False
        }
        
        success, data = self.run_test(
            "Join Room as Admin",
            "POST",
            f"/rooms/{room_id}/join",
            200,
            data=join_data
        )
        
        if success and data:
            self.test_data['admin_user'] = data.get('user')
            self.log(f"   Admin user created: {data.get('user', {}).get('name')}")
            
            # Verify admin status
            if data.get('user', {}).get('is_admin'):
                self.log("   ✅ User is correctly set as admin")
            else:
                self.log("   ⚠️  User should be admin (first user)")
                
        return success
    
    def test_join_room_as_regular_user(self):
        """Test joining room as second user (regular)"""
        if 'room' not in self.test_data:
            self.log("❌ Skipping - No room created")
            return False
            
        room_id = self.test_data['room']['id']
        join_data = {
            "room_id": room_id,
            "name": "Test Player",
            "is_spectator": False
        }
        
        success, data = self.run_test(
            "Join Room as Regular User",
            "POST",
            f"/rooms/{room_id}/join",
            200,
            data=join_data
        )
        
        if success and data:
            self.test_data['regular_user'] = data.get('user')
            self.log(f"   Regular user created: {data.get('user', {}).get('name')}")
            
            # Verify NOT admin
            if not data.get('user', {}).get('is_admin'):
                self.log("   ✅ User is correctly NOT admin")
            else:
                self.log("   ⚠️  User should NOT be admin (second user)")
                
        return success
    
    def test_join_room_as_spectator(self):
        """Test joining room as spectator"""
        if 'room' not in self.test_data:
            self.log("❌ Skipping - No room created")
            return False
            
        room_id = self.test_data['room']['id']
        join_data = {
            "room_id": room_id,
            "name": "Test Observer",
            "is_spectator": True
        }
        
        success, data = self.run_test(
            "Join Room as Spectator",
            "POST",
            f"/rooms/{room_id}/join",
            200,
            data=join_data
        )
        
        if success and data:
            self.test_data['spectator_user'] = data.get('user')
            self.log(f"   Spectator created: {data.get('user', {}).get('name')}")
            
            # Verify spectator status
            if data.get('user', {}).get('is_spectator'):
                self.log("   ✅ User is correctly set as spectator")
            else:
                self.log("   ⚠️  User should be spectator")
                
        return success
    
    def test_create_task(self):
        """Test creating a task"""
        if 'room' not in self.test_data:
            self.log("❌ Skipping - No room created")
            return False
            
        room_id = self.test_data['room']['id']
        task_data = {
            "room_id": room_id,
            "title": "Test User Story",
            "description": "As a user, I want to test the API"
        }
        
        success, data = self.run_test(
            "Create Task",
            "POST",
            "/tasks",
            200,
            data=task_data
        )
        
        if success and data:
            self.test_data['task'] = data
            self.log(f"   Task created: {data.get('title')}")
            
            # Verify task structure
            required_fields = ['id', 'room_id', 'title', 'status']
            for field in required_fields:
                if field not in data:
                    self.log(f"   ⚠️  Missing field: {field}")
                    
            # Verify default status
            if data.get('status') == 'PENDING':
                self.log("   ✅ Task status is correctly PENDING")
            else:
                self.log(f"   ⚠️  Task status should be PENDING, got: {data.get('status')}")
                
        return success
    
    def test_get_tasks(self):
        """Test getting tasks for a room"""
        if 'room' not in self.test_data:
            self.log("❌ Skipping - No room created")
            return False
            
        room_id = self.test_data['room']['id']
        success, data = self.run_test(
            "Get Room Tasks",
            "GET",
            f"/rooms/{room_id}/tasks",
            200
        )
        
        if success and isinstance(data, list):
            self.log(f"   Found {len(data)} tasks")
            if len(data) > 0:
                self.log(f"   First task: {data[0].get('title')}")
        
        return success
    
    def test_get_room_state(self):
        """Test getting complete room state"""
        if 'room' not in self.test_data:
            self.log("❌ Skipping - No room created")
            return False
            
        room_id = self.test_data['room']['id']
        success, data = self.run_test(
            "Get Room State",
            "GET",
            f"/rooms/{room_id}/state",
            200
        )
        
        if success and data:
            # Verify state structure
            expected_keys = ['room', 'users', 'tasks', 'votes', 'active_task']
            for key in expected_keys:
                if key not in data:
                    self.log(f"   ⚠️  Missing state key: {key}")
                else:
                    if key == 'users':
                        self.log(f"   Users: {len(data[key])}")
                    elif key == 'tasks':
                        self.log(f"   Tasks: {len(data[key])}")
                    elif key == 'votes':
                        self.log(f"   Votes: {len(data[key])}")
                        
        return success
    
    def test_join_nonexistent_room(self):
        """Test joining a non-existent room"""
        join_data = {
            "room_id": "INVALID123",
            "name": "Test User",
            "is_spectator": False
        }
        
        success, data = self.run_test(
            "Join Non-existent Room",
            "POST",
            "/rooms/INVALID123/join",
            404,
            data=join_data
        )
        return success
    
    def test_create_task_invalid_room(self):
        """Test creating task for non-existent room"""
        task_data = {
            "room_id": "INVALID123",
            "title": "Invalid Task",
            "description": "This should fail"
        }
        
        success, data = self.run_test(
            "Create Task for Invalid Room",
            "POST",
            "/tasks",
            404,
            data=task_data
        )
        return success
    
    def run_all_tests(self):
        """Run all backend API tests"""
        self.log("🚀 Starting PyPlanPoker Backend API Tests")
        self.log(f"   Base URL: {self.base_url}")
        self.log("=" * 60)
        
        # Basic API tests
        self.test_root_endpoint()
        self.test_fibonacci_endpoint()
        
        # Room management tests
        self.test_create_room()
        self.test_get_room()
        self.test_get_nonexistent_room()
        
        # User management tests
        self.test_join_room_as_admin()
        self.test_join_room_as_regular_user()
        self.test_join_room_as_spectator()
        self.test_join_nonexistent_room()
        
        # Task management tests
        self.test_create_task()
        self.test_get_tasks()
        self.test_create_task_invalid_room()
        
        # State management tests
        self.test_get_room_state()
        
        # Print summary
        self.log("=" * 60)
        self.log(f"📊 Test Results: {self.tests_passed}/{self.tests_run} passed")
        
        if self.tests_passed == self.tests_run:
            self.log("🎉 All tests passed!")
            return 0
        else:
            self.log(f"❌ {self.tests_run - self.tests_passed} tests failed")
            return 1

def main():
    """Main test runner"""
    tester = PyPlanPokerAPITester()
    return tester.run_all_tests()

if __name__ == "__main__":
    sys.exit(main())