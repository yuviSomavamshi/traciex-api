start=`date +%s`
sh generate.sh
npm run prettify
docker-compose -f docker-compose.yml build

docker tag breathalyzer_api:traciex blockchain.azurecr.io/breathalyzer_api:traciex
docker push blockchain.azurecr.io/breathalyzer_api:traciex

end=`date +%s`
runtime=$((end-start))
echo "$runtime"
