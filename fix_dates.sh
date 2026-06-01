for file in src/components/dashboard/*.tsx; do
  sed -i 's/const start = `${startDate}T00:00:00`;/const start = new Date(`${startDate}T00:00:00`).toISOString();/g' $file
  sed -i 's/const end = `${endDate}T23:59:59`;/const end = new Date(`${endDate}T23:59:59`).toISOString();/g' $file
done
