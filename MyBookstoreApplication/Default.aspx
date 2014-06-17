<%@ Page Title="Home Page" Language="C#" MasterPageFile="~/Site.master" AutoEventWireup="true"
    CodeBehind="Default.aspx.cs" Inherits="MyBookstoreApplication._Default" %>

<asp:Content ID="HeaderContent" runat="server" ContentPlaceHolderID="HeadContent">
</asp:Content>
<asp:Content ID="BodyContent" runat="server" ContentPlaceHolderID="MainContent">
    <h2>
        Welcome to My Bookstore Application!
    </h2>
    <p>This sample shows how an ASP.NET web application can use PDFNet Cloud API to upload documents, list the uploaded documents, and view the documents.
    </p>
    <p>
        To run this sample, a PDFNet Cloud API free evaluation account is required. <a href="https://api.pdftron.com/register.jsp">Click here to sign up now!</a>
        <br />
        Once you have signed up, you will receive an API Id and API secret in email.
        <br />
        Update PDFTronApiClient.cs with your API info, and you are good to go. Start by <a href="Upload.aspx">uploading a file</a>.
    </p>
</asp:Content>
