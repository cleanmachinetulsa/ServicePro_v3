
import zipfile
import os
from pathlib import Path

def should_exclude(path_str):
    """Check if a path should be excluded from the archive."""
    excludes = [
        'node_modules', '.git', 'dist', 'build', '.config',
        'attached_assets', 'public/uploads', 'public/tech_profiles',
        'public/images', 'public/assets', 'server/tests',
        '.jpg', '.jpeg', '.png', '.gif', '.svg', '.webp', '.ico',
        '.pdf', '.xlsx', '.docx', '.txt', '.mp4', '.mov',
        '.tar.gz', '.zip', '.log'
    ]
    
    for exclude in excludes:
        if exclude in path_str:
            return True
    return False

def create_zip():
    """Create a minimal zip archive of the core codebase."""
    zip_filename = 'clean-machine-core.zip'
    
    # Define files and directories to include
    includes = [
        'client/src',
        'server',
        'shared/schema.ts',
        'package.json',
        'tsconfig.json',
        'drizzle.config.ts',
        'tailwind.config.ts',
        'components.json',
        'vite.config.ts',
        'postcss.config.js'
    ]
    
    with zipfile.ZipFile(zip_filename, 'w', zipfile.ZIP_DEFLATED) as zipf:
        for include in includes:
            path = Path(include)
            
            if path.is_file():
                if not should_exclude(str(path)):
                    print(f"Adding file: {path}")
                    zipf.write(path, path)
            elif path.is_dir():
                for root, dirs, files in os.walk(path):
                    # Filter out excluded directories
                    dirs[:] = [d for d in dirs if not should_exclude(os.path.join(root, d))]
                    
                    for file in files:
                        file_path = os.path.join(root, file)
                        if not should_exclude(file_path):
                            print(f"Adding file: {file_path}")
                            zipf.write(file_path, file_path)
    
    # Get file size
    size = os.path.getsize(zip_filename)
    size_mb = size / (1024 * 1024)
    print(f"\nCreated {zip_filename} ({size_mb:.2f} MB)")

if __name__ == '__main__':
    create_zip()
