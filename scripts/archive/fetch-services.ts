import { getServiceData } from './pricing.js';

(async () => {
  try {
    const services = await getServiceData();
    console.log(JSON.stringify(services, null, 2));
  } catch (error) {
    console.error('Error:', error);
  }
})();
