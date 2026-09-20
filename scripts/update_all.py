# -*- coding: utf-8 -*-
"""GitHub Actions 定时更新入口：从远程数据源拉取数据 → 生成 data/*.json
在 GitHub Actions 环境中运行（无本地Excel依赖，数据源改为公开API）

当前版本：直接使用仓库中已有的 data/*.json（由用户本地更新后push）
后续版本：接入公开API自动拉取（iFinD不可用于CI，需改用公开数据源）
"""
import json
import os
import datetime

DATA_DIR = os.path.join(os.path.dirname(__file__), '..', 'data')

def update_timestamp():
    """更新 meta.json 的时间戳"""
    meta_path = os.path.join(DATA_DIR, 'meta.json')
    if os.path.exists(meta_path):
        with open(meta_path, 'r', encoding='utf-8') as f:
            meta = json.load(f)
        meta['updated_at'] = datetime.datetime.now().strftime('%Y-%m-%d %H:%M')
        meta['update_source'] = 'GitHub Actions'
        with open(meta_path, 'w', encoding='utf-8') as f:
            json.dump(meta, f, ensure_ascii=False)
        print(f"✓ meta.json updated: {meta['updated_at']}")

def check_data_files():
    """检查所有数据文件是否存在且非空"""
    required = ['meta', 'valuation', 'earnings', 'sentiment',
                'macro_cn', 'liquidity', 'macro_global',
                'scoring', 'hf_macro', 'ai_pressure']
    for name in required:
        path = os.path.join(DATA_DIR, f'{name}.json')
        if os.path.exists(path):
            size = os.path.getsize(path)
            print(f"  {name}.json: {size/1024:.0f}KB {'✓' if size > 100 else '⚠️ EMPTY'}")
        else:
            print(f"  {name}.json: ✗ MISSING")

if __name__ == '__main__':
    print(f"=== Data Update: {datetime.datetime.now().strftime('%Y-%m-%d %H:%M')} ===")
    check_data_files()
    update_timestamp()
    print("=== Done ===")
