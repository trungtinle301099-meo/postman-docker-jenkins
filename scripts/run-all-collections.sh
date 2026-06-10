#!/bin/sh

set +e

COLLECTION_DIR="collections"
ENVIRONMENT_DIR="environments"

REPORT_HTML_DIR="reports/html"
REPORT_JUNIT_DIR="reports/junit"
REPORT_JSON_DIR="reports/json"

mkdir -p "$REPORT_HTML_DIR" "$REPORT_JUNIT_DIR" "$REPORT_JSON_DIR"

FINAL_EXIT_CODE=0

echo "===================================================="
echo " Running all Postman collections with all environments"
echo "===================================================="

COLLECTION_FOUND=0
ENVIRONMENT_FOUND=0

for COLLECTION_FILE in "$COLLECTION_DIR"/*.postman_collection.json; do
  if [ ! -f "$COLLECTION_FILE" ]; then
    continue
  fi

  COLLECTION_FOUND=1
  COLLECTION_NAME=$(basename "$COLLECTION_FILE" .postman_collection.json)

  for ENV_FILE in "$ENVIRONMENT_DIR"/*.postman_environment.json; do
    if [ ! -f "$ENV_FILE" ]; then
      continue
    fi

    ENVIRONMENT_FOUND=1
    ENV_NAME=$(basename "$ENV_FILE" .postman_environment.json)

    REPORT_NAME="${COLLECTION_NAME}-${ENV_NAME}"

    echo ""
    echo "----------------------------------------------------"
    echo "Collection : $COLLECTION_NAME"
    echo "Environment: $ENV_NAME"
    echo "Collection file: $COLLECTION_FILE"
    echo "Environment file: $ENV_FILE"
    echo "Report name: $REPORT_NAME"
    echo "----------------------------------------------------"

    newman run "$COLLECTION_FILE" \
      -e "$ENV_FILE" \
      -r cli,htmlextra,junit,json \
      --reporter-htmlextra-export "$REPORT_HTML_DIR/${REPORT_NAME}-report.html" \
      --reporter-junit-export "$REPORT_JUNIT_DIR/${REPORT_NAME}-junit.xml" \
      --reporter-json-export "$REPORT_JSON_DIR/${REPORT_NAME}-newman-report.json"

    EXIT_CODE=$?

    if [ $EXIT_CODE -ne 0 ]; then
      echo "FAILED: $COLLECTION_NAME with $ENV_NAME"
      FINAL_EXIT_CODE=1
    else
      echo "PASSED: $COLLECTION_NAME with $ENV_NAME"
    fi
  done
done

if [ $COLLECTION_FOUND -eq 0 ]; then
  echo "ERROR: No Postman collection files found in $COLLECTION_DIR/"
  exit 1
fi

if [ $ENVIRONMENT_FOUND -eq 0 ]; then
  echo "ERROR: No Postman environment files found in $ENVIRONMENT_DIR/"
  exit 1
fi

echo ""
echo "===================================================="
echo " Completed all Postman collections and environments"
echo " Final exit code: $FINAL_EXIT_CODE"
echo "===================================================="

exit $FINAL_EXIT_CODE
