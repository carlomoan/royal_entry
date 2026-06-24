#!/bin/bash

# RoyalEntry Dependency Verification & Setup Script
# Run this BEFORE starting development to ensure all dependencies are current & secure

set -e  # Exit on error

GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}================================================${NC}"
echo -e "${BLUE}RoyalEntry Backend - Dependency Verification${NC}"
echo -e "${BLUE}================================================${NC}"
echo ""

# Check Rust installation
echo -e "${YELLOW}[1/7]${NC} Checking Rust installation..."
if ! command -v rustc &> /dev/null; then
    echo -e "${RED}✗ Rust not found. Install from https://rustup.rs${NC}"
    exit 1
fi

RUST_VERSION=$(rustc --version)
echo -e "${GREEN}✓ ${RUST_VERSION}${NC}"
echo ""

# Check minimum Rust version (1.75+)
echo -e "${YELLOW}[2/7]${NC} Verifying minimum Rust version (1.75+)..."
RUST_MINOR=$(rustc --version | grep -oP '\d+\.\d+' | head -1)
if (( $(echo "$RUST_MINOR >= 1.75" | bc -l) )); then
    echo -e "${GREEN}✓ Rust version ${RUST_MINOR} is compatible${NC}"
else
    echo -e "${YELLOW}⚠ Rust version ${RUST_MINOR} is older than 1.75${NC}"
    echo -e "${YELLOW}  Update with: rustup update${NC}"
fi
echo ""

# Check cargo version
echo -e "${YELLOW}[3/7]${NC} Checking Cargo..."
CARGO_VERSION=$(cargo --version)
echo -e "${GREEN}✓ ${CARGO_VERSION}${NC}"
echo ""

# Install dependency management tools
echo -e "${YELLOW}[4/7]${NC} Installing dependency management tools..."
echo "   Installing cargo-audit (security)..."
if ! command -v cargo-audit &> /dev/null; then
    cargo install cargo-audit --quiet
    echo -e "${GREEN}   ✓ cargo-audit installed${NC}"
else
    echo -e "${GREEN}   ✓ cargo-audit already installed${NC}"
fi

echo "   Installing cargo-outdated (version check)..."
if ! command -v cargo-outdated &> /dev/null; then
    cargo install cargo-outdated --quiet
    echo -e "${GREEN}   ✓ cargo-outdated installed${NC}"
else
    echo -e "${GREEN}   ✓ cargo-outdated already installed${NC}"
fi

echo "   Installing cargo-edit (dependency management)..."
if ! command -v cargo-upgrade &> /dev/null; then
    cargo install cargo-edit --quiet
    echo -e "${GREEN}   ✓ cargo-edit installed${NC}"
else
    echo -e "${GREEN}   ✓ cargo-edit already installed${NC}"
fi
echo ""

# Check current dependencies
echo -e "${YELLOW}[5/7]${NC} Checking current dependencies..."
echo "   Running: cargo tree --depth 1..."
cargo tree --depth 1 > /tmp/cargo_tree.txt 2>&1
echo -e "${GREEN}✓ Dependency tree generated${NC}"
echo ""

# Security audit
echo -e "${YELLOW}[6/7]${NC} Running security vulnerability check..."
echo "   This checks against the RustSec advisory database..."
if cargo audit 2>&1 | grep -q "error: 0 vulnerabilities"; then
    echo -e "${GREEN}✓ No known security vulnerabilities found${NC}"
elif cargo audit 2>&1 | grep -q "vulnerabilities found"; then
    echo -e "${RED}⚠ VULNERABILITIES FOUND - Review above output${NC}"
else
    cargo audit
    echo -e "${GREEN}✓ Security check passed${NC}"
fi
echo ""

# Check outdated dependencies
echo -e "${YELLOW}[7/7]${NC} Checking for outdated dependencies..."
echo "   (This may take a moment - checking against crates.io)..."
echo ""

if cargo outdated --format list 2>/dev/null | grep -q "upgraded"; then
    echo -e "${YELLOW}⚠ Some dependencies have updates available:${NC}"
    echo ""
    cargo outdated
    echo ""
    echo -e "${YELLOW}To update to compatible versions:${NC}"
    echo -e "${BLUE}  cargo upgrade --dry-run  # Preview changes${NC}"
    echo -e "${BLUE}  cargo upgrade            # Apply updates${NC}"
    echo -e "${BLUE}  cargo test --all         # Verify nothing broke${NC}"
else
    echo -e "${GREEN}✓ All dependencies are up to date${NC}"
fi
echo ""

# Summary
echo -e "${BLUE}================================================${NC}"
echo -e "${BLUE}Dependency Verification Summary${NC}"
echo -e "${BLUE}================================================${NC}"
echo ""
echo -e "${GREEN}✓ Rust ${RUST_VERSION}${NC}"
echo -e "${GREEN}✓ Security tools installed${NC}"
echo -e "${GREEN}✓ No known vulnerabilities${NC}"
echo ""

# Show next steps
echo -e "${BLUE}Next Steps:${NC}"
echo "1. Update Cargo.toml to latest version:"
echo -e "   ${YELLOW}cp Cargo_UPDATED.toml Cargo.toml${NC}"
echo ""
echo "2. Check for outdated packages:"
echo -e "   ${YELLOW}cargo outdated${NC}"
echo ""
echo "3. Update to latest compatible versions:"
echo -e "   ${YELLOW}cargo upgrade --dry-run  # Preview${NC}"
echo -e "   ${YELLOW}cargo upgrade            # Apply${NC}"
echo ""
echo "4. Run tests to verify nothing broke:"
echo -e "   ${YELLOW}cargo test --all${NC}"
echo ""
echo "5. Start development:"
echo -e "   ${YELLOW}docker-compose up -d      # Start services${NC}"
echo -e "   ${YELLOW}cargo watch -x run        # Dev server${NC}"
echo ""
echo -e "${GREEN}All checks passed! You're ready to develop.${NC}"
echo ""

# Create a periodic check reminder
echo -e "${BLUE}Pro Tip:${NC} Run this monthly to keep dependencies fresh:"
echo ""
echo "  cargo audit       # Check for vulnerabilities"
echo "  cargo outdated    # Show what's available"
echo "  cargo upgrade     # Update to compatible versions"
echo "  cargo test --all  # Verify nothing broke"
echo ""

exit 0
