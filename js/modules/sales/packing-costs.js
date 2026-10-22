function getPackingCostPerOrder(){return Number(sellerBooksStorage.getItem("sellerbooks_packing_unit_cost")||0)||0;}
function getTotalPackingCost(){const imports=JSON.parse(sellerBooksStorage.getItem("sellerbooks_sales_imports")||"[]");return imports.reduce(function(total,item){return total+Number(item.totalPackingCost||0);},0);}
