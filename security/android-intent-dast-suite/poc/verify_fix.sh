#!/bin/bash
# ═══════════════════════════════════════════════════════════════
# Regression Test: 驗證修復後的 SafeProxyActivity
# 對應 1.txt 第 5 節的回歸驗證
# ═══════════════════════════════════════════════════════════════

set -e

PACKAGE="com.example.vulnerableapp"
SAFE_PROXY="${PACKAGE}/.SafeProxyActivity"
TARGET1="${PACKAGE}/.internal.AdminSecretActivity"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo "═══════════════════════════════════════════════"
echo "  Regression: Verify Fix (SafeProxyActivity)"
echo "═══════════════════════════════════════════════"

PASS=0
FAIL=0

# ── Test 1: 確認修復後的 PoC 被阻擋 ──
echo -e "\n${YELLOW}[Test 1] Attempt Intent Redirection on SAFE proxy${NC}"
adb shell am force-stop "$PACKAGE"
sleep 0.5

adb shell am start \
    -n "${SAFE_PROXY}" \
    --es target_intent "#Intent;component=${TARGET1};end" 2>/dev/null

sleep 1.5
CURRENT=$(adb shell dumpsys activity top | grep "ACTIVITY" | head -1)

if echo "$CURRENT" | grep -q "AdminSecretActivity"; then
    echo -e "${RED}❌ FAIL — Private activity still reachable!${NC}"
    FAIL=$((FAIL + 1))
else
    echo -e "${GREEN}✅ PASS — Attack blocked by SafeProxyActivity${NC}"
    PASS=$((PASS + 1))
fi

# ── Test 2: 確認正常功能不受影響 ──
echo -e "\n${YELLOW}[Test 2] Normal business flow still works${NC}"
adb shell am force-stop "$PACKAGE"
sleep 0.5

# 啟動 MainActivity
adb shell am start -n "${PACKAGE}/.MainActivity"
sleep 1.5
CURRENT2=$(adb shell dumpsys activity top | grep "ACTIVITY" | head -1)

if echo "$CURRENT2" | grep -q "MainActivity"; then
    echo -e "${GREEN}✅ PASS — MainActivity launches correctly${NC}"
    PASS=$((PASS + 1))
else
    echo -e "${RED}❌ FAIL — MainActivity broken${NC}"
    FAIL=$((FAIL + 1))
fi

# ── Test 3: Logcat 確認有安全日誌 ──
echo -e "\n${YELLOW}[Test 3] Check security log output${NC}"
LOGS=$(adb logcat -d -s "*:E" -t 50 2>/dev/null | grep -i "Security\|BLOCKED\|SafeProxy")
if [ -n "$LOGS" ]; then
    echo -e "${GREEN}✅ PASS — Security logs found:${NC}"
    echo "$LOGS" | head -5
    PASS=$((PASS + 1))
else
    echo -e "${YELLOW}⚠️  WARN — No security logs found (may need logcat filter)${NC}"
fi

# ── Summary ──
echo ""
echo "═══════════════════════════════════════════════"
TOTAL=$((PASS + FAIL))
echo "  Results: ${PASS}/${TOTAL} passed"
if [ $FAIL -eq 0 ]; then
    echo -e "  ${GREEN}✅ ALL TESTS PASSED — Fix is effective${NC}"
else
    echo -e "  ${RED}❌ SOME TESTS FAILED — Fix needs review${NC}"
fi
echo "═══════════════════════════════════════════════"

adb shell am force-stop "$PACKAGE"
exit $FAIL
