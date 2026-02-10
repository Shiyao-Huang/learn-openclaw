#!/usr/bin/env python3
"""通义听悟转录脚本"""
import os
import sys
import json
import time
import hashlib
import hmac
import base64
import urllib.request
import urllib.parse
from datetime import datetime, timezone

# 配置
ACCESS_KEY_ID = "os.environ.get("ALIYUN_ACCESS_KEY_ID", "")"
ACCESS_KEY_SECRET = "os.environ.get("ALIYUN_ACCESS_KEY_SECRET", "")"
APP_KEY = "os.environ.get("TINGWU_APP_KEY", "")"

def sign(method, url, headers, body=None):
    """生成签名"""
    parsed = urllib.parse.urlparse(url)
    
    # 规范化请求
    canonical_uri = parsed.path or "/"
    canonical_query = parsed.query or ""
    
    # 签名头
    signed_headers = "host;x-acs-action;x-acs-content-sha256;x-acs-date;x-acs-signature-nonce;x-acs-version"
    
    body_hash = hashlib.sha256((body or "").encode()).hexdigest()
    headers["x-acs-content-sha256"] = body_hash
    
    canonical_headers = "\n".join([
        f"host:{parsed.netloc}",
        f"x-acs-action:{headers['x-acs-action']}",
        f"x-acs-content-sha256:{body_hash}",
        f"x-acs-date:{headers['x-acs-date']}",
        f"x-acs-signature-nonce:{headers['x-acs-signature-nonce']}",
        f"x-acs-version:{headers['x-acs-version']}"
    ])
    
    canonical_request = f"{method}\n{canonical_uri}\n{canonical_query}\n{canonical_headers}\n\n{signed_headers}\n{body_hash}"
    
    # 签名字符串
    hashed_request = hashlib.sha256(canonical_request.encode()).hexdigest()
    string_to_sign = f"ACS3-HMAC-SHA256\n{hashed_request}"
    
    # 计算签名
    signature = hmac.new(
        ACCESS_KEY_SECRET.encode(),
        string_to_sign.encode(),
        hashlib.sha256
    ).hexdigest()
    
    headers["Authorization"] = f"ACS3-HMAC-SHA256 Credential={ACCESS_KEY_ID},SignedHeaders={signed_headers},Signature={signature}"
    
    return headers

def create_task(file_url):
    """创建转录任务"""
    url = "https://tingwu.cn-beijing.aliyuncs.com/"
    
    headers = {
        "Content-Type": "application/json",
        "x-acs-action": "CreateTask",
        "x-acs-version": "2023-09-30",
        "x-acs-date": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "x-acs-signature-nonce": hashlib.md5(str(time.time()).encode()).hexdigest()
    }
    
    body = json.dumps({
        "AppKey": APP_KEY,
        "Input": {
            "SourceLanguage": "en",
            "FileUrl": file_url,
            "TaskKey": f"task_{int(time.time())}"
        },
        "Parameters": {
            "Transcription": {
                "DiarizationEnabled": True,
                "Diarization": {"SpeakerCount": 0}
            }
        }
    })
    
    headers = sign("POST", url, headers, body)
    
    req = urllib.request.Request(url, data=body.encode(), headers=headers, method="POST")
    
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            return json.loads(resp.read().decode())
    except urllib.error.HTTPError as e:
        print(f"HTTP Error: {e.code}")
        print(e.read().decode())
        return None

def get_task(task_id):
    """查询任务状态"""
    url = f"https://tingwu.cn-beijing.aliyuncs.com/?TaskId={task_id}"
    
    headers = {
        "x-acs-action": "GetTaskInfo",
        "x-acs-version": "2023-09-30",
        "x-acs-date": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "x-acs-signature-nonce": hashlib.md5(str(time.time()).encode()).hexdigest()
    }
    
    headers = sign("GET", url, headers)
    
    req = urllib.request.Request(url, headers=headers, method="GET")
    
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            return json.loads(resp.read().decode())
    except urllib.error.HTTPError as e:
        print(f"HTTP Error: {e.code}")
        print(e.read().decode())
        return None

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python tingwu_transcribe.py <file_url>")
        sys.exit(1)
    
    file_url = sys.argv[1]
    print(f"Creating task for: {file_url}")
    
    result = create_task(file_url)
    if result:
        print(json.dumps(result, indent=2, ensure_ascii=False))
        
        if "Data" in result and "TaskId" in result["Data"]:
            task_id = result["Data"]["TaskId"]
            print(f"\nTask ID: {task_id}")
            print("Polling for result...")
            
            while True:
                time.sleep(10)
                status = get_task(task_id)
                if status:
                    task_status = status.get("Data", {}).get("TaskStatus")
                    print(f"Status: {task_status}")
                    
                    if task_status == "COMPLETED":
                        print(json.dumps(status, indent=2, ensure_ascii=False))
                        break
                    elif task_status == "FAILED":
                        print("Task failed!")
                        print(json.dumps(status, indent=2, ensure_ascii=False))
                        break
