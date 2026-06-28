import rarfile
import os
import sys

rar_path = "/home/runner/workspace/attached_assets/finance_1782651146029.rar"
output_dir = "/home/runner/workspace"

SKIP_PREFIXES = [
    "finance/.local/share/pnpm/",
    "finance/.git/",
    "finance/.local/secondary_skills/",
    "finance/.local/skills/",
]

def should_skip(name):
    for prefix in SKIP_PREFIXES:
        if name.startswith(prefix):
            return True
    return False

print(f"Opening {rar_path}...")
try:
    with rarfile.RarFile(rar_path) as rf:
        all_files = rf.namelist()
        print(f"Total files in archive: {len(all_files)}")
        
        project_files = [f for f in all_files if not should_skip(f)]
        print(f"Project files to extract: {len(project_files)}")
        
        print("\nProject structure preview:")
        for f in project_files[:50]:
            print(f"  {f}")
        
        print("\nExtracting project files...")
        extracted = 0
        for name in project_files:
            try:
                rf.extract(name, output_dir)
                extracted += 1
                if extracted % 50 == 0:
                    print(f"  Extracted {extracted}/{len(project_files)} files...")
            except Exception as e:
                print(f"  Skip {name}: {e}")
        
        print(f"\nDone! Extracted {extracted} files to {output_dir}/finance/")
except Exception as e:
    print(f"Error: {e}")
    import traceback
    traceback.print_exc()
