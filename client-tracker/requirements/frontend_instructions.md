#Project Overview
Create a client tracker, that allows me to track their ARR, the contracted volume for products in their contract and show that in a progress bar, and alert icons for whether one or more products is going over contracted amounts.

#Feature Requirements
- Ability to add, edit, and delete clients
- Ability to add, edit, and delete products
- Ability to paste a text file of contracts and products to automatically add them to the database
- Ability to paste a text file of client utilization data to automatically add them to the database
- Ability to project whether a client will be over contracted and alert me with an icon 

#Relevant Docs

#Current File Structure
/client-tracker
├── frontend/
│   ├── public/
│   │   ├── index.html
│   │   └── favicon.ico
│   ├── src/
│   │   ├── components/
│   │   │   ├── clients/
│   │   │   │   ├── ClientList.js
│   │   │   │   ├── ClientForm.js
│   │   │   │   └── ClientDetails.js
│   │   │   ├── products/
│   │   │   │   ├── ProductList.js
│   │   │   │   └── ProductForm.js
│   │   │   ├── utilization/
│   │   │   │   ├── UtilizationChart.js
│   │   │   │   └── AlertIcon.js
│   │   │   └── common/
│   │   │       ├── Header.js
│   │   │       └── ProgressBar.js
│   │   ├── services/
│   │   │   ├── api.js
│   │   │   └── utils.js
│   │   ├── styles/
│   │   │   └── main.css
│   │   ├── App.js
│   │   └── index.js
│   ├── package.json
│   └── README.md
├── backend/
│   ├── src/
│   │   ├── controllers/
│   │   │   ├── clientController.js
│   │   │   ├── productController.js
│   │   │   └── utilizationController.js
│   │   ├── models/
│   │   │   ├── Client.js
│   │   │   ├── Product.js
│   │   │   └── Utilization.js
│   │   ├── routes/
│   │   │   ├── clientRoutes.js
│   │   │   ├── productRoutes.js
│   │   │   └── utilizationRoutes.js
│   │   └── app.js
│   ├── package.json
│   └── README.md
├── requirements/
│   └── frontend_instructions.md
└── README.md
